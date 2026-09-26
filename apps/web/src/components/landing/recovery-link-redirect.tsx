'use client';

import { useEffect } from 'react';

/**
 * Recovery-link catch (redirect allow-list fallback): when Supabase Auth
 * rejects the recovery email's redirect_to (not allow-listed), it falls
 * back to the SiteURL root - THIS page - with the recovery tokens in the
 * URL. Nothing here would ever consume them, so forward the visitor to
 * /reset-password preserving the exact query + fragment. Renders nothing.
 */
export function RecoveryLinkRedirect() {
  useEffect(() => {
    const { search, hash } = window.location;
    const fragment = new URLSearchParams(hash.replace(/^#/, ''));
    const isImplicitRecovery =
      hash.includes('access_token=') && fragment.get('type') === 'recovery';
    const isPkceRecovery = new URLSearchParams(search).has('code');
    if (isImplicitRecovery || isPkceRecovery) {
      window.location.replace(`/reset-password${search}${hash}`);
    }
  }, []);

  return null;
}
