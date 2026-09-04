import type { ExpiringSoonItem, ExpiryBucketKey, LowStockItem, RecentSaleItem } from '@pharmaguard/types';
import { formatDaysLeft, formatPKR, formatRelativeTime, expiryTone, EXPIRY_BUCKET_COLORS } from '@/lib/format';
import { EmptyState } from '@/components/ui/states';

/**
 * List widgets (PRD §10.5, reference composition): Low Stock Alerts,
 * Expiring Soon, Recent Sales - each titled with a green "View All" link.
 */

function CardShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {action ?? null}
      </div>
      {children}
    </div>
  );
}

const TONE_BADGE_STYLES: Record<ExpiryBucketKey, string> = {
  expired: 'bg-status-expired-bg text-status-expired-fg',
  critical: 'bg-status-critical-bg text-status-critical-fg',
  warning: 'bg-status-warning-bg text-status-warning-fg',
  safe: 'bg-status-safe-bg text-status-safe-fg',
};

export function LowStockCard({ items }: { items: LowStockItem[] }) {
  return (
    <CardShell
      title="Low Stock Alerts"
      action={
        <a href="/inventory" className="text-xs font-medium text-primary-700 transition hover:text-primary-800 hover:underline">
          View All
        </a>
      }
    >
      {items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((item) => {
            const levelPct =
              item.reorderLevel > 0
                ? Math.min(100, Math.round((item.quantity / item.reorderLevel) * 100))
                : 0;
            return (
              <li key={item.medicineId} className="rounded-md border border-border-subtle p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {item.name}
                      {item.strength ? ` ${item.strength}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {item.quantity} in stock · reorder at {item.reorderLevel}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.quantity <= 0
                        ? TONE_BADGE_STYLES.critical
                        : TONE_BADGE_STYLES.warning
                    }`}
                  >
                    {item.quantity <= 0 ? 'Out of Stock' : 'Low Stock'}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className={`h-full rounded-full ${
                      item.quantity <= 0 ? 'bg-status-critical-fg' : 'bg-status-warning-fg'
                    }`}
                    style={{ width: `${Math.max(levelPct, 4)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No low-stock medicines" description="Every stocked medicine is above its reorder level." />
      )}
    </CardShell>
  );
}

export function ExpiringSoonCard({ items }: { items: ExpiringSoonItem[] }) {
  return (
    <CardShell
      title="Expiring Soon"
      action={
        <a href="/expiry" className="text-xs font-medium text-primary-700 transition hover:text-primary-800 hover:underline">
          View All
        </a>
      }
    >
      {items.length > 0 ? (
        <ul className="divide-y divide-border-subtle">
          {items.map((item) => {
            const tone = expiryTone(item.daysLeft);
            return (
              <li key={item.batchId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {item.medicineName}
                    {item.strength ? ` ${item.strength}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Batch {item.batchNo} · {item.quantity} units ·{' '}
                    {new Date(`${item.expiryDate}T00:00:00`).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE_BADGE_STYLES[tone]}`}
                >
                  {formatDaysLeft(item.daysLeft)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="Nothing expiring soon" description="No batches expire within the next 30 days." />
      )}
    </CardShell>
  );
}

export function RecentSalesCard({ items }: { items: RecentSaleItem[] }) {
  return (
    <CardShell
      title="Recent Sales"
      action={
        <a href="/sales" className="text-xs font-medium text-primary-700 transition hover:text-primary-800 hover:underline">
          View All
        </a>
      }
    >
      {items.length > 0 ? (
        <ul className="divide-y divide-border-subtle">
          {items.map((item) => (
            <li key={item.saleId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">
                  {item.medicineName}
                  {item.strength ? ` ${item.strength}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  Batch {item.batchNo} · Qty {item.quantity} · {formatRelativeTime(item.soldAt)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-text-primary">
                {formatPKR(item.totalAmount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No sales recorded yet" description="Sales will appear here as they happen." />
      )}
    </CardShell>
  );
}

export function StockStatusCard({
  status,
}: {
  status: { inStock: number; lowStock: number; outOfStock: number; expired: number; quarantined: number };
}) {
  const rows = [
    { label: 'In Stock', value: status.inStock, color: EXPIRY_BUCKET_COLORS.safe },
    { label: 'Low Stock', value: status.lowStock, color: EXPIRY_BUCKET_COLORS.warning },
    { label: 'Out of Stock', value: status.outOfStock, color: EXPIRY_BUCKET_COLORS.critical },
    { label: 'Expired', value: status.expired, color: EXPIRY_BUCKET_COLORS.expired },
    { label: 'Quarantined', value: status.quarantined, color: '#5b6773' },
  ];

  return (
    <CardShell
      title="Stock Status"
      action={<span className="text-xs text-text-faint">All Medicines</span>}
    >
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-text-muted">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              {row.label}
            </span>
            <span className="font-medium text-text-primary">{row.value}</span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
