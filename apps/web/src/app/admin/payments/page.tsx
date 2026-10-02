import type { Metadata } from 'next';
import AdminPaymentsPage from './admin-payments-page';

export const metadata: Metadata = {
  title: 'Payment Reviews | PharmaGuard',
};

export default function AdminPayments() {
  return <AdminPaymentsPage />;
}
