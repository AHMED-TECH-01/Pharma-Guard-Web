'use client';

import Link from 'next/link';
import type { SupplierListItem } from '@pharmaguard/types';
import { formatRelativeTime } from '@/lib/format';

/**
 * Supplier overview card (registry §3): contact, medicines supplied, last
 * order, and pending returns. Links to the supplier detail page.
 */
export function SupplierCard({ supplier }: { supplier: SupplierListItem }) {
  return (
    <Link
      href={`/suppliers/${supplier.id}`}
      className="block rounded-xl border border-border bg-card p-5 transition hover:border-primary-500/60 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text-primary">{supplier.name}</h3>
          <p className="mt-0.5 text-sm text-text-secondary">
            {supplier.phone ?? 'No phone'} {supplier.email ? `- ${supplier.email}` : ''}
          </p>
        </div>
        {supplier.isArchived ? (
          <span className="rounded-full bg-bg-subtle px-2.5 py-0.5 text-xs font-medium text-text-secondary">
            Archived
          </span>
        ) : supplier.pendingReturns > 0 ? (
          <span className="rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-medium text-status-warning-fg">
            {supplier.pendingReturns} pending return{supplier.pendingReturns === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">Medicines supplied</p>
          <p className="font-medium text-text-primary">{supplier.medicinesSupplied}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Last order</p>
          <p className="font-medium text-text-primary">
            {supplier.lastOrderAt ? formatRelativeTime(supplier.lastOrderAt) : 'None yet'}
          </p>
        </div>
      </div>

      {supplier.medicineNames.length > 0 ? (
        <p className="mt-3 line-clamp-1 text-xs text-text-muted">
          {supplier.medicineNames.join(', ')}
        </p>
      ) : null}
    </Link>
  );
}
