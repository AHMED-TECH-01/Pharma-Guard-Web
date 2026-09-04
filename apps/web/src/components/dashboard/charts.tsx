'use client';

import {
  CartesianGrid,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ExpiryOverview, SalesTrendPoint } from '@pharmaguard/types';
import { EXPIRY_BUCKET_COLORS, formatPKR, formatPKRCompact } from '@/lib/format';
import { EmptyState } from '@/components/ui/states';

/**
 * Sales Overview (7-day trend) and Expiry Overview (next 90 days donut).
 * Recharts 3.x (verified: React 19 compatible). Colors come from the
 * token palette mapped in globals.css. Reference fidelity: the trend line
 * is brand green and the most recent day carries a "PKR …" value badge.
 */

/** Brand green (primary-600) used for the sales trend line. */
const SALES_LINE_COLOR = '#0a9a69';

/** Rounded "PKR 32,300"-style badge drawn above the last trend point. */
function TrendValueBadge({
  viewBox,
  value,
}: {
  viewBox?: { x?: number; y?: number };
  value: string;
}) {
  if (viewBox?.x === undefined || viewBox?.y === undefined) return null;
  const badgeWidth = value.length * 6.6 + 18;
  return (
    <g transform={`translate(${viewBox.x - badgeWidth / 2}, ${viewBox.y - 36})`} aria-hidden>
      <rect width={badgeWidth} height={22} rx={11} fill='#ffffff' stroke='#dee2e6' />
      <text
        x={badgeWidth / 2}
        y={15}
        textAnchor='middle'
        fontSize={11}
        fontWeight={600}
        fill='#212529'
      >
        {value}
      </text>
    </g>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-card p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {subtitle ? <span className="text-xs text-text-faint">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

export function SalesOverview({
  data,
  title = 'Sales Overview',
  subtitle = 'This Week',
}: {
  data: SalesTrendPoint[];
  title?: string;
  subtitle?: string;
}) {
  const hasSales = data.some((point) => point.total > 0);

  return (
    <ChartCard title={title} subtitle={subtitle}>
      {hasSales ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 18, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: '#dee2e6' }}
                tick={{ fontSize: 12, fill: '#6c757d' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#6c757d' }}
                tickFormatter={(value: number) => formatPKRCompact(value)}
                width={72}
              />
              <Tooltip
                formatter={(value) => [formatPKR(Number(value)), 'Sales']}
                labelStyle={{ color: '#212529', fontWeight: 600 }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #dee2e6',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke={SALES_LINE_COLOR}
                strokeWidth={2.5}
                dot={{ r: 3, fill: SALES_LINE_COLOR }}
                activeDot={{ r: 5 }}
              />
              {data.length > 0 ? (
                <ReferenceDot
                  x={data[data.length - 1]!.label}
                  y={data[data.length - 1]!.total}
                  r={4.5}
                  fill={SALES_LINE_COLOR}
                  stroke='#ffffff'
                  strokeWidth={2}
                >
                  <Label content={<TrendValueBadge value={formatPKR(data[data.length - 1]!.total)} />} />
                </ReferenceDot>
              ) : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="No sales recorded this week"
          description="Record your first sale to see the daily trend here."
        />
      )}
    </ChartCard>
  );
}

export function ExpiryOverview({ overview }: { overview: ExpiryOverview }) {
  const segments = overview.buckets.filter((bucket) => bucket.count > 0);

  return (
    <ChartCard title="Expiry Overview" subtitle="Next 90 Days">
      {overview.totalBatches > 0 ? (
        <div className="flex h-64 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative h-56 w-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={segments}
                  dataKey="count"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {segments.map((segment) => (
                    <Cell
                      key={segment.key}
                      fill={EXPIRY_BUCKET_COLORS[segment.key]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} batches`, name]}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #dee2e6',
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-text-primary">{overview.totalBatches}</span>
              <span className="text-xs text-text-muted">Total Batches</span>
            </div>
          </div>
          <ul className="w-full space-y-2 sm:w-1/2">
            {overview.buckets.map((bucket) => (
              <li key={bucket.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-text-muted">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: EXPIRY_BUCKET_COLORS[bucket.key] }}
                    aria-hidden="true"
                  />
                  {bucket.label}
                </span>
                <span className="font-medium text-text-primary">{bucket.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          title="No batches in stock"
          description="Add inventory to see how expiry risk is distributed."
        />
      )}
    </ChartCard>
  );
}
