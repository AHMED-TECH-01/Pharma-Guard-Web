import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { PLANS } from '@/lib/plans';

/**
 * PlanCards (ui-rules §19): easy-to-compare plan grid with price, billing
 * period, feature list, CTA, and a "Recommended" badge. Values come from
 * the shared plans data (PRD §10.22).
 */

interface PlanCardsProps {
  /** CTA target - landing links to signup, pricing page links to contact. */
  ctaHref?: string;
  ctaLabel?: string;
}

export function PlanCards({ ctaHref = '/signup', ctaLabel = 'Get Started' }: PlanCardsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={`relative flex flex-col rounded-lg border bg-surface p-6 shadow-sm ${
            plan.recommended ? 'border-primary-600' : 'border-border'
          }`}
        >
          {plan.recommended ? (
            <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-primary-700 px-2.5 py-0.5 text-xs font-medium text-white">
              <Sparkles className="size-3" aria-hidden />
              Recommended
            </span>
          ) : null}

          <h3 className="text-base font-semibold">{plan.name}</h3>
          <p className="mt-1 text-xs text-text-muted">{plan.description}</p>

          <p className="mt-4">
            <span className="text-2xl font-semibold tracking-tight">{plan.price}</span>
            {plan.period ? (
              <span className="text-sm text-text-muted">{plan.period}</span>
            ) : null}
          </p>

          <ul className="mt-5 flex-1 space-y-2.5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-status-success-fg" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href={ctaHref}
            className={`mt-6 flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors duration-150 ${
              plan.recommended
                ? 'bg-primary-700 text-white hover:bg-primary-800'
                : 'border border-border bg-surface hover:bg-surface-muted'
            }`}
          >
            {plan.id === 'enterprise' ? 'Contact Us' : ctaLabel}
          </Link>
        </div>
      ))}
    </div>
  );
}
