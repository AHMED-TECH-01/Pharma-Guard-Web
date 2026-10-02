import type { Metadata } from 'next';
import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { PlanCards } from '@/components/landing/plan-cards';
import { FaqSection } from '@/components/landing/faq-section';

export const metadata: Metadata = {
  title: 'Pricing',
};

/**
 * Pricing page (PRD §10.22, ui-rules §19). Plan values come from the shared
 * plans data so the landing section and this page never diverge.
 */
export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-surface-muted">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Pricing that fits a single counter - or a chain.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
              Every plan includes batch-level expiry tracking, the AI medicine scanner and
              role-based access. Start free, then subscribe from your dashboard - payments
              are verified by our team, usually within a day.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-14">
          <PlanCards />
          <p className="mt-8 text-center text-xs text-text-muted">
            All prices in PKR, billed monthly. Pay via Easypaisa, JazzCash or bank transfer.
          </p>
        </section>

        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}
