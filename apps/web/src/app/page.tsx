import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  CalendarClock,
  Check,
  ClipboardCheck,
  Cross,
  FileCheck2,
  LayoutDashboard,
  Package,
  PackageSearch,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  Upload,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { SiteHeader } from '@/components/landing/site-header';
import { SiteFooter } from '@/components/landing/site-footer';
import { PlanCards } from '@/components/landing/plan-cards';
import { FaqSection } from '@/components/landing/faq-section';

/**
 * Landing page (PRD §10.1): hero, problem statement, how it works, AI OCR
 * demonstration, expiry protection, smart reorder, analytics, feature
 * overview, pricing, FAQ, CTA, footer. Static server components only.
 */

function SectionShell({
  id,
  eyebrow,
  title,
  lead,
  children,
  tone = 'plain',
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead: string;
  children: React.ReactNode;
  tone?: 'plain' | 'muted' | 'brand';
}) {
  const background =
    tone === 'muted' ? 'bg-surface-muted' : tone === 'brand' ? 'bg-primary-950 text-white' : '';
  return (
    <section id={id} className={background ? background : undefined}>
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <p className={`text-xs font-semibold uppercase tracking-widest ${tone === 'brand' ? 'text-primary-500' : 'text-primary-700'}`}>
          {eyebrow}
        </p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <p className={`mt-3 max-w-2xl text-sm leading-relaxed ${tone === 'brand' ? 'text-white/75' : 'text-text-muted'}`}>
          {lead}
        </p>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <section className="border-b border-border bg-surface-muted">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-primary-800">
          <ShieldCheck className="size-3.5" aria-hidden />
          Built for independent pharmacies in Pakistan
        </span>
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Make every pharmacy safer and smarter.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted">
          PharmaGuard turns inventory data into clear, timely actions - expiring batches
          caught before they harm patients or your margin, reorders suggested before
          stockouts, and compliance records kept without paperwork.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary-700 px-6 text-sm font-medium text-white transition-colors duration-150 hover:bg-primary-800"
          >
            Create your account
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/pricing"
            className="flex h-11 items-center justify-center rounded-md border border-border bg-surface px-6 text-sm font-medium transition-colors duration-150 hover:bg-surface"
          >
            View pricing
          </Link>
        </div>
        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
          {['Batch-level expiry tracking', 'AI medicine scanner', 'DRAP-friendly audit trail'].map(
            (item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-status-success-fg" aria-hidden />
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

const PROBLEMS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: AlertTriangle,
    title: 'Expired stock on shelves',
    text: 'Expired medicines remain in inventory unnoticed until they are sold or discovered too late.',
  },
  {
    icon: ClipboardCheck,
    title: 'Manual expiry tracking',
    text: 'Batch numbers and expiry dates live in notebooks and spreadsheets, not in actionable systems.',
  },
  {
    icon: PackageSearch,
    title: 'Surprise stockouts',
    text: 'Fast-moving medicines become unavailable exactly when patients need them most.',
  },
  {
    icon: Warehouse,
    title: 'Capital in dead stock',
    text: 'Money sits tied up in dead or overstocked medicines while best-sellers run out.',
  },
  {
    icon: FileCheck2,
    title: 'Audit anxiety',
    text: 'Poor batch visibility and history tracking make compliance reviews stressful.',
  },
  {
    icon: Activity,
    title: 'No actionable analytics',
    text: 'Existing enterprise systems are complex and expensive for small independent pharmacies.',
  },
];

function ProblemSection() {
  return (
    <SectionShell
      id="problem"
      eyebrow="The problem"
      title="Small pharmacies run on paper while risk accumulates silently."
      lead="Every one of these gaps costs money, compliance standing, or patient safety - usually all three."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROBLEMS.map((problem) => {
          const Icon = problem.icon;
          return (
            <div key={problem.title} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-md bg-status-critical-bg">
                <Icon className="size-4 text-status-critical-fg" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{problem.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{problem.text}</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

const STEPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: ClipboardCheck,
    title: '1. Create your account',
    text: 'Sign up and set up your pharmacy profile in minutes.',
  },
  {
    icon: ScanLine,
    title: '2. Add medicines',
    text: 'Scan medicine leaflets with AI OCR or import your existing list.',
  },
  {
    icon: Package,
    title: '3. Track every batch',
    text: 'Expiry dates, quantities and suppliers tracked batch by batch.',
  },
  {
    icon: BellRing,
    title: '4. Act on alerts',
    text: 'Get ahead of expiries, low stock and reorder points daily.',
  },
];

function HowItWorksSection() {
  return (
    <SectionShell
      id="how-it-works"
      tone="muted"
      eyebrow="How it works"
      title="From sign-up to safer shelves in one afternoon."
      lead="PharmaGuard behaves like an operational intelligence layer, not a generic inventory form."
    >
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary-950">
                <Icon className="size-4 text-primary-500" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </SectionShell>
  );
}

const OCR_FLOW: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: Upload,
    title: 'Upload an image',
    text: 'Drop in a photo of the medicine leaflet or box. No camera capture needed.',
  },
  {
    icon: ScanLine,
    title: 'AI extracts details',
    text: 'Name, strength, batch number, expiry date and dosage form are read automatically.',
  },
  {
    icon: ClipboardCheck,
    title: 'You review',
    text: 'Every extracted field is shown with a confidence score and stays fully editable.',
  },
  {
    icon: Check,
    title: 'You confirm',
    text: 'Nothing enters your inventory without your explicit confirmation. Ever.',
  },
];

function OcrSection() {
  return (
    <SectionShell
      id="ai-ocr"
      eyebrow="AI OCR"
      title="Medicine entry that takes seconds, with you always in control."
      lead="AI reads the paperwork; you make the decision. Results are never saved without review."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {OCR_FLOW.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative rounded-lg border border-border bg-surface p-5 shadow-sm">
              <span className="absolute right-4 top-4 text-xs font-semibold text-text-muted">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex size-9 items-center justify-center rounded-md bg-status-info-bg">
                <Icon className="size-4 text-status-info-fg" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{step.text}</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

const EXPIRY_BUCKETS = [
  { label: 'Expired', text: 'Remove from sale immediately and quarantine for returns.', className: 'border-status-expired-border bg-status-expired-bg text-status-expired-fg' },
  { label: 'Critical · 0-30 days', text: 'Prioritise FEFO sales, prepare returns to suppliers.', className: 'border-status-critical-border bg-status-critical-bg text-status-critical-fg' },
  { label: 'Warning · 31-90 days', text: 'Discount or promote to move stock while value remains.', className: 'border-status-warning-border bg-status-warning-bg text-status-warning-fg' },
  { label: 'Safe · 90+ days', text: 'Normal sales with continuous background monitoring.', className: 'border-status-safe-border bg-status-safe-bg text-status-safe-fg' },
];

function ExpirySection() {
  return (
    <SectionShell
      id="expiry-protection"
      tone="muted"
      eyebrow="Expiry protection"
      title="Every batch classified the day it arrives, watched every day after."
      lead="The Expiry Center turns expiry dates into buckets with concrete actions - so near-expiry stock is discovered early, not during an audit."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {EXPIRY_BUCKETS.map((bucket) => (
          <div key={bucket.label} className={`rounded-lg border p-5 ${bucket.className}`}>
            <h3 className="text-sm font-semibold">{bucket.label}</h3>
            <p className="mt-1 text-sm opacity-90">{bucket.text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

const VALUE_FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: BellRing,
    title: 'Smart reorder',
    text: 'Reorder points learned from your sales velocity. Suggestions arrive before stockouts, with recommended quantities.',
  },
  {
    icon: BarChart3,
    title: 'Analytics that answer questions',
    text: 'Sales trends, fast and slow movers, dead stock, overstock and expiry exposure - with a pharmacy health score.',
  },
  {
    icon: FileCheck2,
    title: 'Compliance support',
    text: 'Batch-level audit timeline of every change, sale, return and quarantine - exportable when inspectors ask.',
  },
];

function ValueSection() {
  return (
    <SectionShell
      id="value"
      eyebrow="Operational intelligence"
      title="Reorders, analytics and compliance - from the same data."
      lead="No separate tools to maintain. The inventory you already run your pharmacy with powers everything else."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {VALUE_FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <span className="flex size-10 items-center justify-center rounded-md bg-primary-950">
                <Icon className="size-5 text-primary-500" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{feature.text}</p>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

const FEATURES: Array<{ icon: LucideIcon; title: string }> = [
  { icon: LayoutDashboard, title: 'Operational dashboard' },
  { icon: Package, title: 'Batch-level inventory' },
  { icon: ScanLine, title: 'AI OCR medicine scanner' },
  { icon: CalendarClock, title: 'Expiry Center with actions' },
  { icon: TrendingUp, title: 'Sales recording & trends' },
  { icon: Warehouse, title: 'Purchase & supplier tracking' },
  { icon: AlertTriangle, title: 'Quarantine & recall handling' },
  { icon: FileCheck2, title: 'Audit timeline & reports' },
];

function FeaturesSection() {
  return (
    <SectionShell
      id="features"
      tone="muted"
      eyebrow="Feature overview"
      title="Everything an independent pharmacy needs. Nothing it doesn't."
      lead="Role-based access for owners, managers, pharmacists and staff - everyone sees what they need."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 shadow-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted">
                <Icon className="size-4 text-primary-800" aria-hidden />
              </span>
              <span className="text-sm font-medium">{feature.title}</span>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function PricingSection() {
  return (
    <SectionShell
      id="pricing"
      eyebrow="Pricing"
      title="Simple monthly plans in PKR."
      lead="Start small and grow. Plan enforcement is coming with billing - pricing is a product proposal and may be adjusted before launch."
    >
      <PlanCards />
    </SectionShell>
  );
}

function FinalCta() {
  return (
    <section className="bg-primary-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center sm:py-20">
        <span className="flex size-12 items-center justify-center rounded-lg bg-primary-600">
          <Cross className="size-6" aria-hidden />
        </span>
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Protect your patients and your margin - starting today.
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-white/75">
          Set up your pharmacy in one afternoon. No credit card required to create an account.
        </p>
        <Link
          href="/signup"
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-primary-500 px-6 text-sm font-semibold text-primary-950 transition-colors duration-150 hover:bg-primary-600 hover:text-white"
        >
          Create your account
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSection />
        <HowItWorksSection />
        <OcrSection />
        <ExpirySection />
        <ValueSection />
        <FeaturesSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
