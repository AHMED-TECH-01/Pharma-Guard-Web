'use client';

import { Archive, Pencil } from 'lucide-react';
import type { MedicineStockSummary } from '@pharmaguard/types';
import { formatPKR } from '@/lib/format';
import { StockBadge } from '@/components/ui/badges';

/**
 * MedicineDetailHeader (ui-registry §7): identity block + stock summary +
 * write actions. Action visibility is capability-driven.
 */

interface MedicineDetailHeaderProps {
  name: string;
  strength: string | null;
  genericName: string | null;
  manufacturer: string | null;
  category: string | null;
  barcode: string | null;
  purchasePrice: number | null;
  sellingPrice: number | null;
  reorderLevel: number;
  isArchived: boolean;
  stock: MedicineStockSummary;
  canWrite: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onArchive: () => void;
}

export function MedicineDetailHeader({
  name,
  strength,
  genericName,
  manufacturer,
  category,
  barcode,
  purchasePrice,
  sellingPrice,
  reorderLevel,
  isArchived,
  stock,
  canWrite,
  canDelete,
  onEdit,
  onArchive,
}: MedicineDetailHeaderProps) {
  const facts: { label: string; value: string }[] = [
    { label: 'Generic', value: genericName ?? '—' },
    { label: 'Manufacturer', value: manufacturer ?? '—' },
    { label: 'Category', value: category ?? '—' },
    { label: 'Barcode', value: barcode ?? '—' },
    { label: 'Purchase price', value: purchasePrice !== null ? formatPKR(purchasePrice) : '—' },
    { label: 'Selling price', value: sellingPrice !== null ? formatPKR(sellingPrice) : '—' },
    { label: 'Reorder level', value: String(reorderLevel) },
    { label: 'Batches', value: String(stock.batchCount) },
  ];

  return (
    <section className="rounded-lg border border-border-subtle bg-bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              {name}
              {strength ? ` ${strength}` : ''}
            </h1>
            <StockBadge level={stock.level} />
            {isArchived ? (
              <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs font-medium text-text-muted">
                Archived
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {stock.quantity} units in stock
            {stock.expiredBatches > 0
              ? ` · ${stock.expiredBatches} expired batch${stock.expiredBatches === 1 ? '' : 'es'}`
              : ''}
          </p>
        </div>

        {canWrite ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium transition hover:bg-surface-muted"
            >
              <Pencil className="size-4" aria-hidden />
              Edit
            </button>
            {canDelete && !isArchived ? (
              <button
                type="button"
                onClick={onArchive}
                title="Archive keeps history but removes the medicine from active lists"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium transition hover:bg-surface-muted"
              >
                <Archive className="size-4" aria-hidden />
                Archive
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-faint">{fact.label}</dt>
            <dd className="mt-0.5 truncate text-sm text-text-primary">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
