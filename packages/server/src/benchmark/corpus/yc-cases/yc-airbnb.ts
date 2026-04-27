/**
 * Airbnb (W09) — marketplace / travel
 *
 * Public IPO'd marketplace. Reference case for "two-sided marketplace
 * with strong network effects".
 */

import type { YcCompanyCase } from './yc-company-schema.js'

export const ycAirbnbCase: YcCompanyCase = {
  case_id: 'yc-airbnb-2024',
  company_name: 'Airbnb',
  yc_batch: 'W09',
  source_url: 'https://www.ycombinator.com/companies/airbnb',
  fetched_at: '2026-04-27',

  one_liner: 'Book unique homes and experiences from local hosts worldwide.',
  description:
    'Airbnb operates an online marketplace that connects people who want to rent out their homes with people looking for accommodations in that locale. Listings cover a wide range — apartments, houses, castles, treehouses, igloos — across roughly 100,000 cities and 220+ countries.',
  website: 'https://airbnb.com',

  sector: 'marketplace',
  outcome: 'public',
  stage_at_outcome: 'late-stage',
  outcome_year: 2020,

  ground_truth_bmc: {
    CUSTOMER_SEGMENTS: {
      ground_truth:
        'Two-sided market: (1) travelers seeking unique, often cheaper-than-hotel accommodations, (2) property owners ("hosts") wanting supplemental income from their homes.',
      must_cover: ['travelers', 'hosts', 'two-sided'],
      must_not_cover: ['only travelers', 'only hosts']
    },
    VALUE_PROPOSITIONS: {
      ground_truth:
        'For travelers: unique local stays, often cheaper or better-located than hotels. For hosts: monetize spare space with no upfront capital.',
      must_cover: ['unique stays', 'monetize'],
      must_not_cover: []
    },
    CHANNELS: {
      ground_truth:
        'Mobile apps, web search, SEO-driven listings, paid acquisition, referral programs, host-acquired travelers (network growth).',
      must_cover: ['app', 'search', 'referral'],
      must_not_cover: []
    },
    CUSTOMER_RELATIONSHIPS: {
      ground_truth:
        'Self-service product, customer-support escalation for disputes (damages, cancellations), trust-and-safety reviews on both sides.',
      must_cover: ['self-service', 'reviews', 'trust-and-safety'],
      must_not_cover: []
    },
    REVENUE_STREAMS: {
      ground_truth:
        'Service fee from guests (~14%) and host fee (~3%) on each booking. Premium listings + Airbnb Plus upgrade fees.',
      must_cover: ['service fee', 'commission', 'booking'],
      must_not_cover: ['ads-only']
    },
    KEY_RESOURCES: {
      ground_truth:
        'Liquid two-sided marketplace at global scale, brand, host community, trust-and-safety + payments infrastructure, search/ranking algorithms.',
      must_cover: ['marketplace', 'brand', 'trust-and-safety'],
      must_not_cover: []
    },
    KEY_ACTIVITIES: {
      ground_truth:
        'Marketplace operations (listing quality, search ranking), trust-and-safety, regulatory engagement with cities, payments processing, host onboarding.',
      must_cover: ['marketplace operations', 'regulatory'],
      must_not_cover: []
    },
    KEY_PARTNERSHIPS: {
      ground_truth:
        'Payment processors (Stripe, Adyen, etc), insurance underwriters (Host Protection Insurance), city regulatory bodies for short-term-rental rules, photographers / experience providers.',
      must_cover: ['payments', 'insurance'],
      must_not_cover: []
    },
    COST_STRUCTURE: {
      ground_truth:
        'Engineering + product, marketing / customer acquisition (very high — competitive marketplace), trust-and-safety / customer support, payments processing fees, insurance / damage claims, regulatory + legal.',
      must_cover: ['marketing', 'engineering', 'customer support'],
      must_not_cover: ['inventory cost'] // Airbnb doesn't buy/own homes
    }
  },

  annotator_id: 'sheng-internal',
  annotation_quality: 'draft',
  notes:
    'Reference for marketplace-pattern BMCs. Watch for the "must_not_cover: inventory cost" — common BMC mistake is treating Airbnb like a hotel chain.'
}
