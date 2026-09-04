import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Access-token verification against Supabase Auth JWKS
 * (architecture.md §8 SUPABASE_JWKS_URL, TRD §5).
 *
 * The key set may be injected for unit tests (local key set).
 */

type VerifyKey = Parameters<typeof jwtVerify>[1];

let remoteJwks: VerifyKey | null = null;

function getRemoteJwks(): VerifyKey {
  if (!remoteJwks) {
    const { SUPABASE_JWKS_URL } = getEnv();
    remoteJwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }
  return remoteJwks;
}

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  email?: string;
}

export async function verifyAccessToken(
  token: string,
  keySet?: VerifyKey,
  options?: { issuer?: string },
): Promise<AccessTokenPayload> {
  try {
    const issuer = options?.issuer ?? `${getEnv().SUPABASE_URL}/auth/v1`;
    const { payload } = await jwtVerify(token, keySet ?? getRemoteJwks(), {
      issuer,
      audience: 'authenticated',
    });
    if (!payload.sub) {
      throw ApiError.unauthorized('Invalid session token');
    }
    return payload as AccessTokenPayload;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    // Invalid signature, expired token, wrong issuer/audience, malformed JWT.
    throw ApiError.unauthorized('Invalid or expired session');
  }
}
