import { Suspense } from 'react';
import { PurchasesPage } from './purchases-page';

export const metadata = { title: 'Purchases - PharmaGuard' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchasesPage />
    </Suspense>
  );
}
