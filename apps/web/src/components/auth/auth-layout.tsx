import type { ReactNode } from 'react';
import { BadgeCheck, BellRing, ShieldCheck, ShieldPlus, type LucideIcon } from 'lucide-react';

/**
 * AuthLayout + AuthBrandPanel (ui-registry §5, ui-rules §14/§15): split
 * layout matching the reference - deep-teal brand panel with value bullets
 * and illustration on the left, form content on the right. The brand panel
 * collapses below `lg` (ui-rules §21: mobile is one-column).
 */

const BRAND_POINTS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: ShieldCheck, text: 'Prevent expired medicine sales and ensure patient safety.' },
  { icon: BellRing, text: 'Smart alerts for expiry, low stock & reorder.' },
  { icon: BadgeCheck, text: 'Stay compliant with DRAP guidelines and reduce losses.' },
];

/**
 * Flat illustration matching the reference LOGIN PAGE brand panel: a tilted
 * pill bottle with capsules and leaves on the deep-green shade. Inline SVG
 * (no raster asset) so it stays crisp at every DPI and inherits the
 * ui-tokens palette through the CSS variables.
 */
function AuthIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className} aria-hidden focusable="false">
      <ellipse cx="112" cy="154" rx="88" ry="9" fill="rgba(0, 0, 0, 0.22)" />
      {/* Leaves */}
      <path
        d="M150 112 C 182 102, 204 74, 206 42 C 174 52, 154 80, 150 112 Z"
        fill="var(--color-primary-500)"
      />
      <path
        d="M156 104 C 172 86, 188 66, 202 50"
        stroke="var(--color-primary-900)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M70 120 C 50 110, 40 92, 38 70 C 60 78, 70 98, 72 120 Z"
        fill="var(--color-primary-600)"
      />
      {/* Bottle */}
      <g transform="rotate(-14 120 106)">
        <rect x="98" y="26" width="44" height="26" rx="6" fill="#D7E7E0" />
        <path
          d="M108 30 v18 M120 30 v18 M132 30 v18"
          stroke="#BCD6CB"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <rect x="102" y="52" width="36" height="10" fill="#EDF4F1" />
        <rect x="88" y="60" width="64" height="94" rx="14" fill="#F6FAF8" />
        <rect x="88" y="92" width="64" height="38" fill="#FFFFFF" />
        <rect x="98" y="102" width="32" height="4" rx="2" fill="#D3E2DB" />
        <rect x="98" y="112" width="20" height="4" rx="2" fill="#E2EDE8" />
      </g>
      {/* Capsules and pills spilling toward the front-left */}
      <g transform="translate(54 130) rotate(-24)">
        <rect x="-18" y="-7" width="36" height="14" rx="7" fill="#F6FAF8" />
        <path
          d="M-18 0 a 7 7 0 0 1 7 -7 h 11 v 14 h -11 a 7 7 0 0 1 -7 -7 Z"
          fill="var(--color-primary-600)"
        />
      </g>
      <g transform="translate(92 150) rotate(9)">
        <rect x="-16" y="-6" width="32" height="12" rx="6" fill="#F6FAF8" />
        <path
          d="M-16 0 a 6 6 0 0 1 6 -6 h 10 v 12 h -10 a 6 6 0 0 1 -6 -6 Z"
          fill="var(--color-warning)"
        />
      </g>
      <g transform="translate(26 146)">
        <circle r="9" fill="#F6FAF8" />
        <path d="M0 -9 A 9 9 0 0 0 0 9 Z" fill="var(--color-primary-500)" />
      </g>
      <g transform="translate(146 148) rotate(-38) scale(0.85)">
        <rect x="-16" y="-6" width="32" height="12" rx="6" fill="#F6FAF8" />
        <path
          d="M-16 0 a 6 6 0 0 1 6 -6 h 10 v 12 h -10 a 6 6 0 0 1 -6 -6 Z"
          fill="var(--color-primary-600)"
        />
      </g>
      <circle cx="122" cy="160" r="2.5" fill="#F6FAF8" opacity="0.7" />
      <circle cx="70" cy="160" r="2" fill="#F6FAF8" opacity="0.5" />
    </svg>
  );
}

function AuthBrandPanel() {
  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-primary-950 p-10 text-white lg:flex">
      <div className="flex items-center gap-2.5">
        <ShieldPlus className="size-8" aria-hidden />
        <span className="text-xl font-semibold tracking-tight">PharmaGuard</span>
      </div>

      <div className="my-10">
        <h2 className="max-w-xs text-2xl font-semibold leading-snug">
          Expiry &amp; Compliance Tracker for Pharmacies
        </h2>
        <ul className="mt-8 space-y-5">
          {BRAND_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <li key={point.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <Icon className="size-4 text-primary-500" aria-hidden />
                </span>
                <span className="max-w-[260px] text-sm leading-relaxed text-white/85">
                  {point.text}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative" aria-hidden>
        <AuthIllustration className="w-56 max-w-full" />
      </div>

      <p className="text-xs text-white/50">© 2024 PharmaGuard. All rights reserved.</p>
    </div>
  );
}

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh bg-surface">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
