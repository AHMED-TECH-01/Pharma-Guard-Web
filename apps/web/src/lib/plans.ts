import { PLANS as SHARED_PLANS, type PlanDefinition } from '@pharmaguard/types';

/**
 * Subscription plans - a thin adapter over the shared single source of truth
 * (packages/types/src/billing.ts, subscriptions spec §1). The landing pricing
 * section and the /pricing page render from the exact same data the API
 * enforces, so a price or limit can never diverge between surfaces.
 */

export type Plan = PlanDefinition;

export const PLANS: PlanDefinition[] = SHARED_PLANS;
