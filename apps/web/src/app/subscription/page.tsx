import type { Metadata } from 'next';
import SubscriptionPage from './subscription-page';

export const metadata: Metadata = {
  title: 'Subscription | PharmaGuard',
};

export default function Subscription() {
  return <SubscriptionPage />;
}
