'use client';

import { ChevronRight, Sparkles } from 'lucide-react';
import type { ActionCenterTask } from '@pharmaguard/types';
import { EmptyState } from '@/components/ui/states';

/**
 * AI Daily Summary and Action Center (PRD §10.5, ui-rules §5).
 * The summary is rule-based until Gemini integration lands in Phase 5;
 * the label stays honest about that. Action targets arrive with their
 * owning phases - entries render as inert rows until then.
 */

const SEVERITY_STYLES = {
  CRITICAL: 'bg-status-critical-bg text-status-critical-fg',
  HIGH: 'bg-status-warning-bg text-status-warning-fg',
  MEDIUM: 'bg-info-bg text-info-fg',
  LOW: 'bg-bg-subtle text-text-muted',
} as const;

export function AiDailySummary({ summary, source }: { summary: string; source: 'rules' | 'gemini' }) {
  return (
    <section
      aria-label="AI daily summary"
      className="rounded-lg border border-primary-100 bg-primary-50 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-primary-800">AI Daily Summary</h2>
            <span className="rounded-full border border-primary-200 bg-white px-2 py-0.5 text-xs font-medium text-primary-700">
              {source === 'rules' ? 'Rule-based' : 'Gemini'}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-primary-900">{summary}</p>
          <p className="mt-2 text-xs text-primary-700/80">
            {source === 'rules'
              ? 'Generated from your live KPIs. LLM-written summaries arrive in Phase 5.'
              : 'AI-generated - always review before acting on it.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ActionCenter({ tasks }: { tasks: ActionCenterTask[] }) {
  return (
    <section aria-label="Action center" className="rounded-lg border border-border-subtle bg-bg-card p-5">
      <h2 className="text-sm font-semibold text-text-primary">Action Center</h2>
      {tasks.length > 0 ? (
        <ul className="mt-3 divide-y divide-border-subtle">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              title="Actions unlock as their modules ship"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[task.severity]}`}
              >
                {task.severity}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{task.title}</p>
                <p className="mt-0.5 truncate text-xs text-text-muted">{task.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-text-faint" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="All clear"
          description="No pending inventory risks right now."
        />
      )}
    </section>
  );
}
