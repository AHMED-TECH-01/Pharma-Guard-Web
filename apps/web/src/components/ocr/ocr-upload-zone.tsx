'use client';

import { useRef, useState, type DragEvent } from 'react';
import { CloudUpload } from 'lucide-react';

/**
 * OCRUploadZone (ui-registry §6, PRD §10.6, reference AI SCAN screen):
 * dashed drop zone with a cloud-upload icon, "Drag & drop an image here",
 * a primary "Choose File" button and the supported type/size line.
 * Client-side checks mirror the API's server-side validation (magic-byte
 * sniffing in ocr.service.ts); they exist only to fail fast.
 */

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface OCRUploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function OCRUploadZone({ onFileSelected, disabled = false }: OCRUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function acceptFile(file: File | undefined) {
    setLocalError(null);
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError('Unsupported file type. Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLocalError('The image exceeds the 10 MB size limit.');
      return;
    }
    onFileSelected(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    acceptFile(event.dataTransfer.files[0]);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  return (
    <div className="space-y-2">
      <div
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition ${
          dragging
            ? 'border-primary-500 bg-primary-500/5'
            : 'border-border bg-surface hover:bg-surface-muted'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <CloudUpload className="size-12 text-text-faint" strokeWidth={1.5} aria-hidden />
        <div>
          <p className="text-sm font-medium text-text-primary">Drag &amp; drop an image here</p>
          <p className="mt-1 text-sm text-text-secondary">or</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            // The zone is also clickable; keep the picker opening once.
            event.stopPropagation();
            openPicker();
          }}
          className="h-9 rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          Choose File
        </button>
        <p className="text-xs text-text-faint">JPG, PNG, WEBP up to 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Upload a medicine image"
          className="hidden"
          onChange={(event) => {
            acceptFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
      {localError ? (
        <p role="alert" className="rounded-md bg-status-critical-bg px-3 py-2 text-sm text-status-critical-fg">
          {localError}
        </p>
      ) : null}
    </div>
  );
}
