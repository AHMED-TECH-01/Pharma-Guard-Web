import type { Response } from 'express';

/** Success envelope helper (code-standards.md §5). */
export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}
