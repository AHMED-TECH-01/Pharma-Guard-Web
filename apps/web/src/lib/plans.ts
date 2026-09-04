/**
 * Subscription plans (PRD §10.22). Product proposal values shared by the
 * landing pricing section and the /pricing page so they never diverge.
 * Enforcement stays server-side (TRD §32).
 */

export interface Plan {
  id: 'starter' | 'professional' | 'premium' | 'enterprise';
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'PKR 1,500',
    period: '/month',
    description: 'For single-counter pharmacies getting started.',
    features: [
      'Up to 1,000 medicines',
      '1 user',
      'Basic reports',
      'AI OCR medicine scanner',
      'Expiry alerts',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 'PKR 2,800',
    period: '/month',
    description: 'For busy pharmacies that need automation.',
    features: [
      'Up to 5,000 medicines',
      '3 users',
      'Advanced reports',
      'Priority support',
      'Smart reorder suggestions',
      'Expanded alerts',
    ],
    recommended: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 'PKR 4,000',
    period: '/month',
    description: 'For pharmacies that run on data.',
    features: [
      'Up to 10,000 medicines',
      '5 users',
      'Advanced analytics',
      'SMS alert allowance (if integrated)',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For chains and institutional pharmacies.',
    features: [
      'Unlimited / negotiated inventory',
      'Custom users',
      'Integrations',
      'Dedicated support',
      'Advanced analytics',
    ],
  },
];
