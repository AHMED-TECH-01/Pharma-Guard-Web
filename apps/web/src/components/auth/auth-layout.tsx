import Image from 'next/image';
import { Fragment, type ReactNode } from 'react';
import { FileCheck2, Pill, ScanLine, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

/**
 * AuthLayout + AuthBrandPanel (ui-registry §5, ui-rules §14/§15): split
 * layout matching the reference - deep-teal brand panel with value bullets
 * and illustration on the left, white login card on the soft mint section
 * with subtle decorative circles on the right. The brand panel collapses
 * below `lg` (ui-rules §21: mobile is one-column).
 */

/**
 * Line breaks are explicit so the panel wraps exactly like the reference
 * screenshot (3 / 2 / 3 lines) at every `lg+` viewport instead of relying
 * on font-metric-dependent max-width wrapping.
 */
const BRAND_POINTS: Array<{ icon: LucideIcon; lines: string[] }> = [
  { icon: Pill, lines: ['Prevent expired medicine', 'using AI and manage patient', 'safety'] },
  { icon: ScanLine, lines: ['Scan, alerts for expiry,', 'stock & inventory'] },
  { icon: FileCheck2, lines: ['Stay compliant with DRAP', 'guidelines and reduce', 'losses'] },
];

/**
 * Pharmaceutical artwork used EXACTLY as it appears in the reference login
 * brand panel: the artwork region was extracted 1:1 from
 * `reference-ui/PharmaGuard Login Interface.png` at its native 1536x1024
 * resolution (crop x=178 y=570, 469x332 - full panel width; the objects
 * span x=194..584, y=599..872) into `public/brand/pharma-artwork.png`. It
 * is rendered as an image asset - never redrawn, traced or approximated -
 * with a small alpha feather on each edge so it composites seamlessly onto
 * the panel background while preserving the reference's own colors,
 * proportions and composition.
 */

function AuthBrandPanel() {
  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-primary-950 p-10 text-white lg:flex">
      {/* Soft glow + large translucent arc matching the reference brand
          panel; the artwork below carries the reference's own background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary-500/15 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-[42%] size-96 rounded-full bg-primary-500/10"
      />

      <div className="relative flex items-center gap-2.5">
        <BrandMark variant="outline" className="size-9" />
        <span className="text-xl font-semibold tracking-tight">PharmaGuard</span>
      </div>

      <div className="relative my-10">
        <h2 className="max-w-sm text-3xl font-semibold leading-snug">
          Expiry &amp; Compliance Tracker for Pharmacies
        </h2>
        <ul className="mt-8 space-y-5">
          {BRAND_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.lines[0]} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <Icon className="size-5 text-white" aria-hidden />
                </span>
                <span className="text-sm leading-relaxed text-white/85">
                  {point.lines.map((line, lineIndex) => (
                    <Fragment key={line}>
                      {lineIndex > 0 ? <br /> : null}
                      {line}
                    </Fragment>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Extracted reference artwork, bled edge-to-edge across the panel
          (cancels the p-10 padding) exactly like the reference composition. */}
      <div className="relative -mx-10" aria-hidden>
        <Image
          src="/brand/pharma-artwork.png"
          alt=""
          width={469}
          height={332}
          unoptimized
          draggable={false}
          className="h-auto w-full select-none"
        />
      </div>

      <p className="relative mt-6 text-xs leading-relaxed text-white/50">
        © 2025 PharmaGuard.
        <br />
        All rights reserved.
      </p>
    </div>
  );
}

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-surface-muted">
      <AuthBrandPanel />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-10">
        {/* Pale-mint corner shapes matching the reference right section
            (top-right and bottom-right, clipped by the frame corners). */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 size-96 rounded-full bg-primary-100"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-14 size-80 rounded-full bg-primary-100"
        />
        <div className="relative w-full max-w-[520px] rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-10">
          {children}
        </div>
      </div>
    </div>
  );
}

