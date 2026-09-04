import { Suspense } from 'react';
import { AlertsPageContent } from './alerts-page';
import { AlertSkeleton } from '@/components/safety/safety-skeletons';

/**
 * Alerts Center (ui-registry §10 /alerts). useSearchParams inside the client
 * content requires a Suspense boundary during static prerender.
 */
export default function AlertsPage() {
  return (
    <Suspense fallback={<AlertSkeleton />}>
      <AlertsPageContent />
    </Suspense>
  );
}
