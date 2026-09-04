/**
 * HealthScore (ui-registry §3 - Pharmacy operational score). Transparent
 * penalty model computed server-side; the notes explain every deduction so
 * the number is never a black box (PRD §10.17).
 */

function toneFor(score: number): { text: string; bar: string; label: string; chip: string } {
  if (score >= 80) {
    return {
      text: 'text-status-safe-fg',
      bar: 'bg-status-safe-fg',
      label: 'Healthy',
      chip: 'bg-status-safe-bg text-status-safe-fg',
    };
  }
  if (score >= 50) {
    return {
      text: 'text-status-warning-fg',
      bar: 'bg-status-warning-fg',
      label: 'Needs attention',
      chip: 'bg-status-warning-bg text-status-warning-fg',
    };
  }
  return {
    text: 'text-status-critical-fg',
    bar: 'bg-status-critical-fg',
    label: 'At risk',
    chip: 'bg-status-critical-bg text-status-critical-fg',
  };
}

export function HealthScore({ score, notes }: { score: number; notes: string[] }) {
  const tone = toneFor(score);

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Pharmacy Health Score</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone.chip}`}>{tone.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-4xl font-semibold tabular-nums ${tone.text}`}>{score}</span>
        <span className="text-sm text-text-faint">/ 100</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-bg-subtle"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Pharmacy health score"
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(score, 2)}%` }} />
      </div>
      <ul className="mt-4 space-y-2 text-sm text-text-muted">
        {notes.map((note) => (
          <li key={note} className="flex gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone.bar}`} aria-hidden="true" />
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
