'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type {
  InventoryBatchSortKey,
  InventoryBatchStatusFilter,
} from '@pharmaguard/types';

/**
 * InventoryToolbar (ui-registry §7, reference: search + Status + Sort By +
 * Add Medicine). Search debounces 300ms before it reaches the URL query
 * (TRD §17 - list state lives in the URL).
 */

const STATUS_OPTIONS: { value: InventoryBatchStatusFilter; label: string }[] = [
  { value: 'all', label: 'All status' },
  { value: 'expired', label: 'Expired' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' },
  { value: 'in_stock', label: 'In stock' },
];

const SORT_OPTIONS: { value: InventoryBatchSortKey; label: string }[] = [
  { value: 'expiry', label: 'Expiry date' },
  { value: 'medicine', label: 'Medicine name' },
  { value: 'quantity', label: 'Quantity' },
];

const selectClasses =
  'h-9 rounded-md border border-border bg-surface px-2.5 text-sm text-text-primary focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

interface InventoryToolbarProps {
  search: string;
  status: InventoryBatchStatusFilter;
  sort: InventoryBatchSortKey;
  order: 'asc' | 'desc';
  canWrite: boolean;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: InventoryBatchStatusFilter) => void;
  onSortChange: (sort: InventoryBatchSortKey) => void;
  onOrderToggle: () => void;
  onAddMedicine: () => void;
}

export function InventoryToolbar({
  search,
  status,
  sort,
  order,
  canWrite,
  onSearchChange,
  onStatusChange,
  onSortChange,
  onOrderToggle,
  onAddMedicine,
}: InventoryToolbarProps) {
  const [draft, setDraft] = useState(search);
  const [prevSearch, setPrevSearch] = useState(search);

  // Keep the draft in sync when the URL changes externally (back/forward).
  // Adjusting state during render is React's recommended alternative to a
  // sync effect (react.dev/learn/you-might-not-need-an-effect).
  if (prevSearch !== search) {
    setPrevSearch(search);
    setDraft(search);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== search) onSearchChange(draft);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draft, search, onSearchChange]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search name, generic, barcode…"
          aria-label="Search inventory"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as InventoryBatchStatusFilter)}
        aria-label="Filter by stock status"
        className={selectClasses}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as InventoryBatchSortKey)}
        aria-label="Sort by"
        className={selectClasses}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort By: {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onOrderToggle}
        className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-text-primary transition hover:bg-surface-muted"
        aria-label={`Sort ${order === 'asc' ? 'descending' : 'ascending'}`}
      >
        {order === 'asc' ? '↑ Asc' : '↓ Desc'}
      </button>

      {canWrite ? (
        <button
          type="button"
          onClick={onAddMedicine}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          <Plus className="size-4" aria-hidden />
          Add Medicine
        </button>
      ) : null}
    </div>
  );
}
