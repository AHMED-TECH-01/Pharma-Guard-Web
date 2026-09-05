'use client';

import {
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

/**
 * OTPInput (ui-registry §5): accessible 6-digit verification code input.
 *
 * - Full keyboard support: digits, Backspace (clears / steps back), arrows.
 * - Paste anywhere in the group fills the boxes from the first empty one.
 * - `autocomplete="one-time-code"` on the first box lets SMS/mail clients
 *   autofill the code; `inputMode="numeric"` raises the numeric keyboard.
 * - Entirely controlled: the parent owns the digits string (0-6 chars).
 */

interface OTPInputProps {
  /** Digits entered so far (0-6 characters). */
  value: string;
  onChange: (value: string) => void;
  /** Fired once when the sixth digit is completed. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Marks the group invalid for assistive tech + red borders. */
  invalid?: boolean;
  /** Marks the group expired for assistive tech + amber borders. */
  expired?: boolean;
}

const LENGTH = 6;

export function OTPInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  expired = false,
}: OTPInputProps) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const chars = Array.from({ length: LENGTH }, (_, index) => value[index] ?? '');

  function focusBox(index: number) {
    const target = inputsRef.current[Math.max(0, Math.min(LENGTH - 1, index))];
    target?.focus();
    target?.select();
  }

  function completeIfFull(next: string) {
    if (next.length === LENGTH) {
      onComplete?.(next);
    }
  }

  /** Writes digits starting at startIndex; used by typing and autofill. */
  function commitDigits(startIndex: number, raw: string) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) {
      return;
    }
    const nextChars = value.split('');
    for (let offset = 0; offset < incoming.length && startIndex + offset < LENGTH; offset += 1) {
      nextChars[startIndex + offset] = incoming[offset];
    }
    const next = nextChars.join('').slice(0, LENGTH);
    onChange(next);
    focusBox(Math.min(startIndex + incoming.length, LENGTH - 1));
    completeIfFull(next);
  }

  function handleChange(index: number, raw: string) {
    commitDigits(index, raw);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (chars[index]) {
        const nextChars = value.split('');
        nextChars.splice(index, 1);
        onChange(nextChars.join(''));
      } else if (index > 0) {
        const nextChars = value.split('');
        nextChars.splice(index - 1, 1);
        onChange(nextChars.join(''));
        focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) {
      return;
    }
    onChange(pasted);
    focusBox(Math.min(pasted.length, LENGTH - 1));
    completeIfFull(pasted);
  }

  const borderClass = invalid
    ? 'border-status-critical-border'
    : expired
      ? 'border-status-warning-border'
      : 'border-border';

  return (
    <div
      role="group"
      aria-label="6-digit verification code"
      className="flex justify-center gap-2 sm:gap-3"
      onPaste={handlePaste}
    >
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(element) => {
            inputsRef.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1} of ${LENGTH}`}
          value={char}
          disabled={disabled}
          autoFocus={index === 0}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          className={`h-12 w-10 rounded-md border bg-surface text-center text-lg font-semibold text-text outline-none transition-colors duration-150 focus:border-primary-600 disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-12 ${borderClass}`}
        />
      ))}
    </div>
  );
}
