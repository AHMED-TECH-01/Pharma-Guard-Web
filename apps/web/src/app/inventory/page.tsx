import { Suspense } from 'react';
import { InventoryPageContent } from './inventory-page';
import { TableSkeleton } from '@/components/inventory/inventory-skeletons';

/**
 * Inventory list (ui-registry §10 /inventory). useSearchParams inside the
 * client content requires a Suspense boundary during static prerender.
 */
export default function InventoryPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <InventoryPageContent />
    </Suspense>
  );
}
