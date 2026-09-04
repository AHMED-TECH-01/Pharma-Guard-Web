'use client';

import { useEffect, type ReactNode } from 'react';

/**
 * Modal primitive (ui-registry §9 base). Centered panel over a dimmed
 * backdrop; closes on Esc/backdrop unless pending. Destructive actions
 * built on top of this must confirm within their content.
 */

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  pending?: boolean;
  children: ReactNode;
  /** Wide panels for forms; default is a compact dialog. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Modal({ open, title, onClose, pending = false, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, pending, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative my-8 w-full ${SIZES[size]} rounded-lg bg-bg-card p-6 shadow-lg`}
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {children}
      </div>
    </div>
  );
}
