'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { Batch, MedicineDetail as MedicineDetailData } from '@pharmaguard/types';
import { api, fetchSession, type SessionData } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { ErrorState, EmptyState } from '@/components/ui/states';
import { Modal } from '@/components/ui/modal';
import { MedicineDetailHeader } from '@/components/inventory/medicine-detail-header';
import { BatchTable } from '@/components/inventory/batch-table';
import { FEFORecommendation } from '@/components/inventory/fefo-recommendation';
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog';
import { BatchFormModal } from '@/components/inventory/batch-form-modal';
import { MedicineFormModal } from '@/components/inventory/medicine-form-modal';
import { MedicineDetailSkeleton } from '@/components/inventory/inventory-skeletons';

/**
 * Medicine detail (ui-registry §10 /inventory/[id], PRD §10.7 Batch view).
 * FEFO-ordered batches, stock adjustments with mandatory reason, edit and
 * archival - all audit-logged server-side.
 */
export default function MedicineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const medicineId = typeof params.id === 'string' ? params.id : '';

  const [session, setSession] = useState<SessionData | null>(null);
  const [checked, setChecked] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);

  const [detail, setDetail] = useState<MedicineDetailData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<Batch | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archivePending, setArchivePending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal).then((sessionData) => {
      if (controller.signal.aborted) return;
      if (!sessionData) {
        router.replace('/login');
        return;
      }
      setSession(sessionData);
      setChecked(true);
    });
    return () => controller.abort();
  }, [router]);

  const activePharmacy = session?.activePharmacy ?? null;
  const pharmacyId = activePharmacy?.pharmacyId ?? null;
  // Archive/delete is a destructive, hard-to-reverse action, so it stays
  // restricted to OWNER/MANAGER (matches the RLS delete policy).
  const canDelete = activePharmacy?.role === 'OWNER' || activePharmacy?.role === 'MANAGER';

  const loadDetail = useCallback(
    (signal?: AbortSignal) => {
      if (!pharmacyId || !medicineId) return;
      api
        .get<MedicineDetailData>(`/medicines/${medicineId}`, { pharmacyId, signal })
        .then((response) => {
          if (signal?.aborted) return;
          setDetail(response);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
            setNotFound(true);
            return;
          }
          setLoadError(error instanceof Error ? error.message : 'Unable to load medicine.');
        });
    },
    [pharmacyId, medicineId],
  );

  useEffect(() => {
    if (!checked || !pharmacyId) return;
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => controller.abort();
  }, [checked, pharmacyId, loadDetail]);

  async function handleLogout() {
    setLogoutPending(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Redirect still ends the visible session.
    }
    router.replace('/login');
    router.refresh();
  }

  async function handleArchive() {
    if (!pharmacyId || !detail) return;
    setArchivePending(true);
    try {
      await api.delete(`/medicines/${detail.medicine.id}`, { pharmacyId });
      setArchivePending(false);
      setArchiveOpen(false);
      router.push('/inventory');
    } catch (error) {
      setArchivePending(false);
      setArchiveOpen(false);
      setLoadError(error instanceof Error ? error.message : 'Unable to archive medicine.');
    }
  }

  function renderBody() {
    if (!checked || !session) {
      return (
        <div
          aria-busy="true"
          aria-label="Loading session"
          className="h-64 animate-pulse rounded-lg bg-border-subtle"
        />
      );
    }
    if (!activePharmacy) {
      return (
        <EmptyState
          title="No pharmacy yet"
          description="Create your pharmacy profile first."
          action={
            <button
              type="button"
              onClick={() => router.push('/onboarding')}
              className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Set up my pharmacy
            </button>
          }
        />
      );
    }
    if (notFound) {
      return (
        <EmptyState
          title="Medicine not found"
          description="It may have been deleted or belongs to another pharmacy."
          action={
            <Link
              href="/inventory"
              className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
            >
              Back to inventory
            </Link>
          }
        />
      );
    }
    if (loadError && !detail) {
      return (
        <ErrorState
          title="Could not load this medicine"
          description={loadError}
          onRetry={() => {
            setLoadError(null);
            loadDetail();
          }}
        />
      );
    }
    if (!detail) {
      return <MedicineDetailSkeleton />;
    }

    return (
      <div className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
          <Link href="/inventory" className="transition hover:text-text-primary">
            Inventory
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-text-primary">{detail.medicine.name}</span>
        </nav>

        <MedicineDetailHeader
          name={detail.medicine.name}
          strength={detail.medicine.strength}
          genericName={detail.medicine.genericName}
          manufacturer={detail.medicine.manufacturer}
          category={detail.medicine.category}
          barcode={detail.medicine.barcode}
          purchasePrice={detail.medicine.purchasePrice}
          sellingPrice={detail.medicine.sellingPrice}
          reorderLevel={detail.medicine.reorderLevel}
          isArchived={detail.medicine.isArchived}
          stock={detail.stock}
          canDelete={canDelete}
          onEdit={() => setEditOpen(true)}
          onArchive={() => setArchiveOpen(true)}
        />

        {detail.batches.length > 0 ? <FEFORecommendation batches={detail.batches} /> : null}

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Batches <span className="font-normal text-text-muted">(first-expiry-first-out)</span>
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditingBatch(null);
              setBatchModalOpen(true);
            }}
            className="inline-flex h-8 items-center rounded-md bg-primary-600 px-3 text-xs font-medium text-white transition hover:bg-primary-700"
          >
            Add batch
          </button>
        </div>

        {detail.batches.length > 0 ? (
          <BatchTable
            batches={detail.batches}
            onAdjust={(batch) => setAdjustBatch(batch)}
          />
        ) : (
          <EmptyState
            title="No batches yet"
            description="Add a batch to bring this medicine into stock."
            action={
              <button
                type="button"
                onClick={() => {
                  setEditingBatch(null);
                  setBatchModalOpen(true);
                }}
                className="inline-flex h-9 items-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
              >
                Add batch
              </button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <AppShell
      userName={session?.user.fullName ?? ''}
      userRole={activePharmacy?.role ?? null}
      pharmacyName={activePharmacy?.pharmacyName ?? null}
      onLogout={handleLogout}
      logoutPending={logoutPending}
    >
      {renderBody()}

      {detail ? (
        <>
          <MedicineFormModal
            open={editOpen}
            medicine={detail.medicine}
            onClose={() => setEditOpen(false)}
            onSaved={() => {
              setEditOpen(false);
              loadDetail();
            }}
          />

          <BatchFormModal
            open={batchModalOpen}
            medicineId={detail.medicine.id}
            batch={editingBatch}
            onClose={() => setBatchModalOpen(false)}
            onSaved={() => loadDetail()}
          />

          <StockAdjustmentDialog
            open={adjustBatch !== null}
            batch={adjustBatch}
            onClose={() => setAdjustBatch(null)}
            onAdjusted={() => loadDetail()}
          />

          <Modal
            open={archiveOpen}
            title="Archive medicine"
            onClose={() => setArchiveOpen(false)}
            pending={archivePending}
            size="sm"
          >
            <p className="mt-3 text-sm text-text-muted">
              {detail.medicine.name}
              {detail.medicine.strength ? ` ${detail.medicine.strength}` : ''} will be hidden
              from active inventory lists. Sales history is preserved, and you can restore it
              later.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleArchive}
                disabled={archivePending}
                className="h-9 min-w-24 rounded-md bg-status-critical-fg px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {archivePending ? 'Archiving…' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => setArchiveOpen(false)}
                disabled={archivePending}
                className="h-9 min-w-24 rounded-md border border-border bg-surface px-4 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </Modal>
        </>
      ) : null}
    </AppShell>
  );
}
