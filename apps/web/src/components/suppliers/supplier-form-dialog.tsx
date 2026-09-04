'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';

export interface SupplierFormValues {
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface SupplierFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Partial<SupplierFormValues>;
  pending: boolean;
  onSubmit: (values: SupplierFormValues) => void;
  onClose: () => void;
}

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
const LABEL_CLASS = 'mb-1 block text-sm font-medium text-text-secondary';

/**
 * Add/edit supplier dialog (PRD §10.13). Client validation mirrors
 * createSupplierSchema; the server re-validates.
 */
export function SupplierFormDialog({
  open,
  mode,
  initial,
  pending,
  onSubmit,
  onClose,
}: SupplierFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (name.trim().length < 2) {
      setError('Supplier name must be at least 2 characters.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), address: address.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      pending={pending}
      size="sm"
      title={mode === 'create' ? 'Add supplier' : 'Edit supplier'}
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="supplier-name">
            Name *
          </label>
          <input
            id="supplier-name"
            className={INPUT_CLASS}
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS} htmlFor="supplier-phone">
              Phone
            </label>
            <input
              id="supplier-phone"
              className={INPUT_CLASS}
              value={phone}
              maxLength={40}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="supplier-email">
              Email
            </label>
            <input
              id="supplier-email"
              type="email"
              className={INPUT_CLASS}
              value={email}
              maxLength={255}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="supplier-address">
            Address
          </label>
          <textarea
            id="supplier-address"
            rows={2}
            className={INPUT_CLASS}
            value={address}
            maxLength={500}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        {error ? (
          <p className="text-sm text-status-critical-fg" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-text-primary transition hover:bg-subtle disabled:opacity-60"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
            onClick={submit}
            disabled={pending}
          >
            {pending ? 'Saving…' : mode === 'create' ? 'Add supplier' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
