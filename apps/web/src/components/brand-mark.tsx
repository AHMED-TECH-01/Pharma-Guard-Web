/**
 * BrandMark (ui-registry §2): the PharmaGuard shield-and-cross mark from the
 * reference screens. `solid` is the white shield with a green cross used on
 * dark surfaces (sidebar, mobile drawer); `outline` is fully monochrome
 * (currentColor stroke + cross), matching the reference brand panel where the
 * mark and cross read as one white icon. Inline SVG (no raster asset) so it
 * stays crisp at every DPI and inherits the ui-tokens palette through the CSS
 * variables.
 */

interface BrandMarkProps {
  variant?: 'solid' | 'outline';
  className?: string;
}

export function BrandMark({ variant = 'solid', className }: BrandMarkProps) {
  const solid = variant === 'solid';

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <path
        d="M12 1.8 L20.2 5.2 V11.1 C20.2 16.7 16.7 20.9 12 22.4 C7.3 20.9 3.8 16.7 3.8 11.1 V5.2 Z"
        fill={solid ? '#ffffff' : 'none'}
        stroke={solid ? 'none' : 'currentColor'}
        strokeWidth={solid ? 0 : 1.8}
        strokeLinejoin="round"
      />
      <rect x="10.75" y="7.2" width="2.5" height="8.6" rx="0.8" fill={solid ? 'var(--color-primary-600)' : 'currentColor'} />
      <rect x="7.7" y="10.35" width="8.6" height="2.5" rx="0.8" fill={solid ? 'var(--color-primary-600)' : 'currentColor'} />
    </svg>
  );
}
