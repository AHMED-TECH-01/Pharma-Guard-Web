import { rateLimit, type Options } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * Backend rate limiting (master spec §16, code-standards.md §9).
 *
 *  - Public endpoints:      60 requests / minute / IP
 *  - General authed APIs:   120 requests / minute / user (fallback IP)
 *  - Login:                  5 attempts / 15 minutes / IP + account key
 *  - Password reset:         3 requests / hour / IP + email
 *  - Signup:                 5 requests / hour / IP
 *  - Verification resend:    5 requests / hour / IP + email
 *  - Session exchange:      10 requests / 15 minutes / IP
 *  - AI OCR (Phase 5):      20 requests / hour / user (plan-based later)
 *
 * NOTE: for multi-instance production deployments, replace the default
 * in-memory store with a distributed store (e.g. Redis). Reviewed again in
 * Phase 13; rate limiting is not a substitute for upstream WAF/CDN DDoS
 * protection.
 */

function ipOf(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

function accountKeyOf(req: Request): string {
  const email = req.body && typeof req.body === 'object' ? req.body.email : undefined;
  return typeof email === 'string' ? email.trim().toLowerCase() : 'anonymous';
}

function makeLimiter(
  windowMs: number,
  limit: number,
  keyGenerator: (req: Request) => string,
): ReturnType<typeof rateLimit> {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
    },
  };
  return rateLimit(options as Options);
}

export const publicLimiter = makeLimiter(60_000, 60, ipOf);

export const generalLimiter = makeLimiter(60_000, 120, (req) =>
  req.auth ? `user:${req.auth.userId}` : `ip:${ipOf(req)}`,
);

export const loginLimiter = makeLimiter(15 * 60_000, 5, (req) =>
  `login:${ipOf(req)}:${accountKeyOf(req)}`,
);

export const passwordResetLimiter = makeLimiter(60 * 60_000, 3, (req) =>
  `pwreset:${ipOf(req)}:${accountKeyOf(req)}`,
);

export const signupLimiter = makeLimiter(60 * 60_000, 5, (req) => `signup:${ipOf(req)}`);

export const verificationLimiter = makeLimiter(60 * 60_000, 5, (req) =>
  `verify:${ipOf(req)}:${accountKeyOf(req)}`,
);

export const sessionExchangeLimiter = makeLimiter(15 * 60_000, 10, ipOf);

export const ocrLimiter = makeLimiter(60 * 60_000, 20, (req) =>
  req.auth ? `ocr:user:${req.auth.userId}` : `ocr:ip:${ipOf(req)}`,
);
