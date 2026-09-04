import {
  CalendarClock,
  PackageX,
  TrendingDown,
  TrendingUp,
  Wallet,
  TriangleAlert,
} from 'lucide-react';
import type { DashboardKpis } from '@pharmaguard/types';
import { formatPKR } from '@/lib/format';

/**
 * KPI card row (PRD §10.5, reference composition).
 * Five cards: Total Stock Value, Expiring Soon, Expired, Low Stock, Today's Sales.
 */

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Unit word rendered small next to the value ("Batches", "Medicines"). */
  unit?: string;
  caption: string;
  tone: 'neutral' | 'warning' | 'critical' | 'positive';
  delta?: React.ReactNode;
}

const TONE_ICON_STYLES: Record<KpiCardProps['tone'], string> = {
  neutral: 'bg-primary-50 text-primary-700',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
  positive: 'bg-status-safe-bg text-status-safe-fg',
};

function KpiCard({ icon, label, value, unit, caption, tone, delta }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${TONE_ICON_STYLES[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-text-muted">{unit}</span> : null}
      </p>
      <div className="mt-1 flex items-center gap-1.5 text-xs">
        {delta}
        <span className="text-text-faint">{caption}</span>
      </div>
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: DashboardKpis }) {
  const delta = kpis.todaySalesDeltaPct;
  const deltaUp = delta !== null && delta >= 0;

  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        icon={<Wallet className="h-4 w-4" aria-hidden="true" />}
        label="Total Stock Value"
        value={formatPKR(kpis.totalStockValue)}
        caption="Inventory at cost"
        tone="neutral"
      />
      <KpiCard
        icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
        label="Expiring Soon"
        value={String(kpis.expiringSoonBatches)}
        unit="Batches"
        caption="Within 30 days"
        tone="warning"
      />
      <KpiCard
        icon={<PackageX className="h-4 w-4" aria-hidden="true" />}
        label="Expired"
        value={String(kpis.expiredBatches)}
        unit="Batches"
        caption="Awaiting quarantine"
        tone="critical"
      />
      <KpiCard
        icon={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
        label="Low Stock"
        value={String(kpis.lowStockMedicines)}
        unit="Medicines"
        caption="Reorder recommended"
        tone="warning"
      />
      <KpiCard
        icon={
          delta === null || deltaUp ? (
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-4 w-4" aria-hidden="true" />
          )
        }
        label="Today's Sales"
        value={formatPKR(kpis.todaySalesTotal)}
        caption={delta === null ? 'No baseline from yesterday' : 'from yesterday'}
        tone={delta !== null && deltaUp ? 'positive' : 'neutral'}
        delta={
          delta === null ? null : (
            <span
              className={`inline-flex items-center gap-0.5 font-medium ${
                deltaUp ? 'text-status-safe-fg' : 'text-status-critical-fg'
              }`}
            >
              {deltaUp ? '↑' : '↓'}
              {Math.abs(delta)}%
            </span>
          )
        }
      />
    </section>
  );
}
