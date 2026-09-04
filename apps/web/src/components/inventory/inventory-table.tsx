'use client';

import Link from 'next/link';
import { EllipsisVertical, Eye } from 'lucide-react';
import type { InventoryBatchItem } from '@pharmaguard/types';
import { InventoryStatusBadge } from '@/components/ui/badges';

/**
 * InventoryTable + InventoryMobileCard (ui-registry §7, ui-rules §5/§7,
 * reference INVENTORY - ALL MEDICINES screen): dense batch-level table -
 * Medicine | Batch No. | Expiry Date | Quantity | Status | Actions with
 * view / manage icons; cards on mobile.
 */

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function medicineTitle(item: InventoryBatchItem): string {
  return item.strength ? `${item.medicineName} ${item.strength}` : item.medicineName;
}

export function InventoryTable({ items }: { items: InventoryBatchItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-xs uppercase tracking-wide text-text-muted">
            <th scope="col" className="px-4 py-3 font-medium">Medicine</th>
            <th scope="col" className="px-4 py-3 font-medium">Batch No.</th>
            <th scope="col" className="px-4 py-3 font-medium">Expiry Date</th>
            <th scope="col" className="px-4 py-3 font-medium">Quantity</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-surface-muted">
              <td className="px-4 py-3">
                <Link
                  href={`/inventory/${item.medicineId}`}
                  className="font-medium text-text-primary hover:text-primary-700"
                >
                  {medicineTitle(item)}
                </Link>
              </td>
              <td className="px-4 py-3 text-text-muted">{item.batchNo}</td>
              <td className="px-4 py-3 text-text-primary">{formatDate(item.expiryDate)}</td>
              <td className="px-4 py-3 font-medium text-text-primary">{item.quantity}</td>
              <td className="px-4 py-3">
                <InventoryStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/inventory/${item.medicineId}`}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-primary"
                    aria-label={`View ${medicineTitle(item)} batch ${item.batchNo}`}
                  >
                    <Eye className="size-4" aria-hidden />
                  </Link>
                  <Link
                    href={`/inventory/${item.medicineId}#batches`}
                    className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-primary"
                    aria-label={`Manage ${medicineTitle(item)} batch ${item.batchNo}`}
                  >
                    <EllipsisVertical className="size-4" aria-hidden />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InventoryMobileCard({ items }: { items: InventoryBatchItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/inventory/${item.medicineId}`}
            className="block rounded-lg border border-border-subtle bg-bg-card p-4 transition hover:border-primary-200"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{medicineTitle(item)}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  Batch {item.batchNo} · expires {formatDate(item.expiryDate)}
                </p>
              </div>
              <InventoryStatusBadge status={item.status} />
            </div>
            <p className="mt-3 text-sm font-medium text-text-primary">
              {item.quantity} unit{item.quantity === 1 ? '' : 's'}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
