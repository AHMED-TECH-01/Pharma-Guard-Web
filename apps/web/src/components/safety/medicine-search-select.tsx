'use client';

import { useEffect, useRef, useState } from 'react';
import type { MedicineListResponse } from '@pharmaguard/types';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';

/**
 * MedicineSearchSelect: debounced medicine picker for the recall form (PRD
 * §10.16). Searches the pharmacy's medicines through the standard list
 * endpoint; a selection can be cleared to fall back to a manual batch number.
 */

export interface MedicineOption {
  id: string;
  name: string;
  strength: string | null;
}

interface MedicineSearchSelectProps {
  pharmacyId: string;
  value: MedicineOption | null;
  onChange: (value: MedicineOption | null) => void;
  disabled?: boolean;
}

export function MedicineSearchSelect({
  pharmacyId,
  value,
  onChange,
  disabled = false,
}: MedicineSearchSelectProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MedicineOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close the dropdown on outside clicks.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Debounced search while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({
        search: query,
        status: 'all',
        sort: 'name',
        order: 'asc',
        page: '1',
        pageSize: '8',
      });
      api
        .get<MedicineListResponse>(`/medicines?${params.toString()}`, { pharmacyId, signal: controller.signal })
        .then((response) => {
          setResults(
            response.items.map((item) => ({
              id: item.id,
              name: item.name,
              strength: item.strength ?? null,
            })),
          );
          setError(null);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(cause instanceof Error ? cause.message : 'Search failed.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [open, query, pharmacyId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{value.name}</p>
          {value.strength ? <p className="text-xs text-text-muted">{value.strength}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Clear selected medicine"
          className="rounded p-1 text-text-muted transition hover:bg-surface hover:text-text-primary disabled:opacity-50"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          placeholder="Search medicines…"
          aria-label="Search medicines"
          className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-faint focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
        />
      </div>

      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-bg-card shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-text-muted">Searching…</p>
          ) : error ? (
            <p role="alert" className="px-3 py-2 text-sm text-status-critical-fg">
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">No medicines match.</p>
          ) : (
            <ul>
              {results.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option);
                      setQuery('');
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left transition hover:bg-surface-muted"
                  >
                    <span className="block text-sm font-medium text-text-primary">{option.name}</span>
                    {option.strength ? (
                      <span className="block text-xs text-text-muted">{option.strength}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
