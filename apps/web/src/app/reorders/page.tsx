import { Suspense } from 'react';
import { ReordersPage } from './reorders-page';

export const metadata = { title: 'Reorders - PharmaGuard' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReordersPage />
    </Suspense>
  );
}
