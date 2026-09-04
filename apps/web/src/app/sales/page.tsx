import { Suspense } from 'react';
import { SalesPage } from './sales-page';

export const metadata = { title: 'Sales - PharmaGuard' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SalesPage />
    </Suspense>
  );
}
