'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  OcrFieldKey,
  OcrScanDetail,
  OcrScanListItem,
  PotentialDuplicate,
} from '@pharmaguard/types';
import { api, ApiClientError, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/states';
import { OCRUploadZone } from '@/components/ocr/ocr-upload-zone';
import { OCRProcessingState } from '@/components/ocr/ocr-processing-state';
import { OCRResultCard, type OcrFieldValues } from '@/components/ocr/ocr-result-card';
import { OCRConfirmBar } from '@/components/ocr/ocr-confirm-bar';
import { OCRHistory } from '@/components/ocr/ocr-history';
import { DuplicateWarning } from '@/components/inventory/duplicate-warning';

/**
 * AI Scan page (PRD §10.6, TRD §22 OCR state machine).
 *
 * idle -> processing -> review -> confirmed / discarded, with manual entry
 * as the fallback (TRD §33). The AI never creates inventory: confirmation
 * calls the regular medicine/batch endpoints with the user-reviewed values.
 */

const FIELD_KEYS: OcrFieldKey[] = [
  'medicineName',
  'genericName',
  'strength',
  'dosageForm',
  'manufacturer',
  'batchNumber',
  'manufacturingDate',
  'expiryDate',
];

function valuesFromExtraction(extraction: OcrExtractionShape): OcrFieldValues {
  return {
    medicineName: extraction.medicineName ?? '',
    genericName: extraction.genericName ?? '',
    strength: extraction.strength ?? '',
    dosageForm: extraction.dosageForm ?? '',
    manufacturer: extraction.manufacturer ?? '',
    batchNumber: extraction.batchNumber ?? '',
    manufacturingDate: extraction.manufacturingDate ?? '',
    expiryDate: extraction.expiryDate ?? '',
  };
}

type OcrExtractionShape = OcrScanDetail['extraction'] & object;

type ReadyView = 'upload' | 'processing' | 'review' | 'success';

interface SuccessInfo {
  medicineId: string;
  medicineName: string;
  createdBatch: boolean;
}

export default function AiScanPage() {
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [view, setView] = useState<ReadyView>('upload');
  const [scan, setScan] = useState<OcrScanDetail | null>(null);
  const [values, setValues] = useState<OcrFieldValues | null>(null);
  const [quantity, setQuantity] = useState('0');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OcrFieldKey, string>>>({});
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [scans, setScans] = useState<OcrScanListItem[]>([]);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);

  const loadHistory = useCallback(async (pharmacyId: string) => {
    try {
      const { scans: history } = await api.get<{ scans: OcrScanListItem[] }>('/ocr/scans', {
        pharmacyId,
      });
      setScans(history);
    } catch {
      // History is auxiliary; the page stays usable without it.
      setScans([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal)
      .then((sessionData) => {
        if (controller.signal.aborted) return;
        if (!sessionData) {
          router.replace('/login');
          return;
        }
        setSession(sessionData);
        setSessionReady(true);
        if (sessionData.activePharmacy) {
          void loadHistory(sessionData.activePharmacy.pharmacyId);
        }
      })
      .catch(() => {
        router.replace('/login');
      });
    return () => controller.abort();
  }, [router, loadHistory]);

  const pharmacyId = session?.activePharmacy?.pharmacyId ?? null;

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await api.post('/auth/logout');
    } finally {
      router.replace('/login');
    }
  }

  function resetReview() {
    setScan(null);
    setValues(null);
    setQuantity('0');
    setFieldErrors({});
    setDuplicates(null);
    setActionError(null);
  }

  async function handleFile(file: File) {
    if (!pharmacyId) return;
    setUploadError(null);
    setView('processing');
    try {
      const { scan: completed } = await api.upload<{ scan: OcrScanDetail }>('/ocr/scan', {
        file,
        pharmacyId,
      });
      if (!completed.extraction) {
        throw new Error('The scan completed without an extraction. Please try again.');
      }
      setScan(completed);
      setValues(valuesFromExtraction(completed.extraction));
      setFieldErrors({});
      setDuplicates(null);
      setActionError(null);
      setView('review');
      void loadHistory(pharmacyId);
    } catch (error) {
      setView('upload');
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Scan failed. Try again or add the medicine manually.',
      );
      void loadHistory(pharmacyId);
    }
  }

  async function confirmCreation(confirmDuplicate = false) {
    if (!scan || !values || !pharmacyId) return;
    setActionError(null);

    const errors: Partial<Record<OcrFieldKey, string>> = {};
    if (values.medicineName.trim() === '') {
      errors.medicineName = 'Medicine name is required';
    }
    const hasBatchNo = values.batchNumber.trim() !== '';
    const hasExpiry = values.expiryDate !== '';
    if (hasBatchNo !== hasExpiry) {
      const key: OcrFieldKey = hasBatchNo ? 'expiryDate' : 'batchNumber';
      errors[key] =
        'Batch number and expiry date are both needed to add a batch - fill both or clear both.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setConfirming(true);

    try {
      const { medicine } = await api.post<{ medicine: { id: string; name: string } }>(
        '/medicines',
        {
          name: values.medicineName.trim(),
          genericName: values.genericName.trim() || undefined,
          strength: values.strength.trim() || undefined,
          dosageForm: values.dosageForm.trim() || undefined,
          manufacturer: values.manufacturer.trim() || undefined,
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
        },
        { pharmacyId },
      );

      let createdBatch = false;
      if (hasBatchNo) {
        await api.post(
          `/medicines/${medicine.id}/batches`,
          {
            batchNo: values.batchNumber.trim(),
            manufacturingDate: values.manufacturingDate || undefined,
            expiryDate: values.expiryDate,
            quantity: Math.max(0, Math.floor(Number(quantity) || 0)),
          },
          { pharmacyId },
        );
        createdBatch = true;
      }

      await api.post(
        `/ocr/scans/${scan.id}/confirm`,
        {
          correctedExtraction: Object.fromEntries(FIELD_KEYS.map((key) => [key, values[key]])),
        },
        { pharmacyId },
      );

      setSuccess({ medicineId: medicine.id, medicineName: medicine.name, createdBatch });
      setView('success');
      resetReview();
      void loadHistory(pharmacyId);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409 && !confirmDuplicate) {
        const details = error.details as { potentialDuplicates?: PotentialDuplicate[] } | undefined;
        if (details?.potentialDuplicates?.length) {
          setDuplicates(details.potentialDuplicates);
          return;
        }
      }
      setActionError(error instanceof Error ? error.message : 'Unable to add the medicine.');
    } finally {
      setConfirming(false);
    }
  }

  async function discardScan() {
    if (!scan || !pharmacyId) return;
    setDiscarding(true);
    setActionError(null);
    try {
      await api.post(`/ocr/scans/${scan.id}/discard`, undefined, { pharmacyId });
      resetReview();
      setView('upload');
      void loadHistory(pharmacyId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not discard the scan.');
    } finally {
      setDiscarding(false);
    }
  }

  function renderContent() {
    if (!sessionReady) {
      return <OCRProcessingState message="Loading AI Scan…" />;
    }

    if (!session?.activePharmacy) {
      return (
        <EmptyState
          title="No pharmacy yet"
          description="Create your pharmacy to start scanning medicines with AI."
          action={
            <Link
              href="/onboarding"
              className="h-9 rounded-md bg-primary-600 px-4 text-sm font-medium leading-9 text-white transition hover:bg-primary-700"
            >
              Set up my pharmacy
            </Link>
          }
        />
      );
    }

    if (view === 'processing') {
      return <OCRProcessingState />;
    }

    if (view === 'review' && scan?.extraction && values) {
      return (
        <div className="space-y-4">
          {duplicates ? (
            <DuplicateWarning
              duplicates={duplicates}
              pendingName={values.medicineName}
              pending={confirming}
              onCancel={() => setDuplicates(null)}
              onConfirmCreate={() => void confirmCreation(true)}
            />
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="rounded-md bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg"
            >
              {actionError}
            </p>
          ) : null}

          <OCRResultCard
            extraction={scan.extraction}
            overallConfidence={scan.confidence}
            values={values}
            fieldErrors={fieldErrors}
            onChange={(field, value) =>
              setValues((current) => (current ? { ...current, [field]: value } : current))
            }
          />

          <div className="rounded-lg border border-border bg-surface p-5">
            <label
              htmlFor="ocr-quantity"
              className="mb-1.5 block text-sm font-medium text-text-primary"
            >
              Quantity received (units)
            </label>
            <input
              id="ocr-quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-10 w-40 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="mt-2 text-xs text-text-faint">
              Entered manually - the AI never invents stock quantities.
            </p>
          </div>

          <OCRConfirmBar
            onConfirm={() => void confirmCreation(false)}
            onDiscard={() => void discardScan()}
            pending={confirming}
            discardPending={discarding}
            confirmDisabled={values.medicineName.trim() === ''}
          />
        </div>
      );
    }

    if (view === 'success' && success) {
      return (
        <div className="space-y-4 rounded-lg border border-border bg-surface p-6 text-center">
          <p className="text-3xl" aria-hidden>
            ✅
          </p>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {success.medicineName} added
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {success.createdBatch
                ? 'The medicine and its batch are now in your inventory.'
                : 'The medicine was added without a batch - the scan was missing batch details. Add a batch from the medicine page.'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={`/inventory/${success.medicineId}`}
              className="h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium leading-9 text-text-primary transition hover:bg-surface-muted"
            >
              View medicine
            </Link>
            <button
              type="button"
              onClick={() => {
                setSuccess(null);
                setView('upload');
              }}
              className="h-9 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Scan another
            </button>
          </div>
        </div>
      );
    }

    // view === 'upload'
    return (
      <div className="space-y-6">
        {uploadError ? (
          <div
            role="alert"
            className="rounded-md bg-status-critical-bg px-4 py-3 text-sm text-status-critical-fg"
          >
            <p className="font-medium">Scan failed</p>
            <p className="mt-1">{uploadError}</p>
            <p className="mt-1 text-xs opacity-80">
              You can try again, or add the medicine manually from inventory.
            </p>
          </div>
        ) : null}

        <OCRUploadZone onFileSelected={(file) => void handleFile(file)} />

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            Recent scans
          </h2>
          <OCRHistory scans={scans} />
        </section>
      </div>
    );
  }

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={session?.activePharmacy?.role ?? null}
      pharmacyName={session?.activePharmacy?.pharmacyName ?? null}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-text-primary">AI Medicine Scanner</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Upload a medicine image and let AI extract the details for you.
            You always review and confirm before anything reaches inventory.
          </p>
        </header>
        {renderContent()}
      </div>
    </AppShell>
  );
}
