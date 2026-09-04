import { Suspense } from 'react';
import { ExpiryPageContent } from './expiry-page';
import { ExpiryCenterSkeleton } from '@/components/safety/safety-skeletons';

/**
 * Expiry Center (ui-registry §10 /expiry). useSearchParams inside the client
 * content requires a Suspense boundary during static prerender.
 */
export default function ExpiryPage() {
  return (
    <Suspense fallback={<ExpiryCenterSkeleton />}>
      <ExpiryPageContent />
    </Suspense>
  );
}
