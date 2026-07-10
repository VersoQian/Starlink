/**
 * Speak (YC W17) — AI-powered language-learning app.
 */

import type { YcCompanyCase } from './yc-company-schema.js'

export const ycSpeakCase: YcCompanyCase = {
  case_id: 'yc-speak-2024',
  company_name: 'Speak',
  yc_batch: 'W17',
  source_url: 'https://www.ycombinator.com/companies/speak',
  fetched_at: '2026-06-03',

  one_liner: 'AI-powered language learning focused on speaking practice.',
  description:
    'Speak operates a mobile language-learning app that gives learners on-demand speaking practice with an AI tutor. The product combines guided lessons, interactive conversation, pronunciation feedback, and personalized practice in a consumer subscription model.',
  website: 'https://www.speak.com',

  sector: 'edtech',
  outcome: 'active',
  stage_at_outcome: 'series-b-plus',
  outcome_year: 2024,

  ground_truth_bmc: {
    CUSTOMER_SEGMENTS: {
      ground_truth:
        'Primary segments are self-directed language learners who want practical speaking confidence, especially mobile-first consumers underserved by classroom-style study and vocabulary drills.',
      must_cover: ['language learners', 'speaking confidence', 'mobile-first consumers'],
      must_not_cover: []
    },
    VALUE_PROPOSITIONS: {
      ground_truth:
        'Speak provides low-pressure, on-demand speaking practice with an AI tutor, personalized feedback, and guided lessons that help learners build real conversational fluency.',
      must_cover: ['speaking practice', 'AI tutor', 'personalized feedback'],
      must_not_cover: []
    },
    CHANNELS: {
      ground_truth:
        'The mobile app is the primary delivery channel, supported by app-store discovery, performance marketing, social content, referrals, and the company website.',
      must_cover: ['mobile app', 'app-store discovery', 'performance marketing'],
      must_not_cover: []
    },
    CUSTOMER_RELATIONSHIPS: {
      ground_truth:
        'The product is primarily self-service, with personalized lesson progression, AI-generated feedback, reminders, and habit-forming practice loops.',
      must_cover: ['self-service', 'personalized progression', 'practice loops'],
      must_not_cover: []
    },
    REVENUE_STREAMS: {
      ground_truth:
        'Revenue is primarily generated through paid consumer subscriptions that unlock continued access to AI speaking practice and premium learning features.',
      must_cover: ['consumer subscription', 'premium access'],
      must_not_cover: ['advertising-only']
    },
    KEY_RESOURCES: {
      ground_truth:
        'Key resources include proprietary language-learning content, conversational AI models and orchestration, speech-recognition capabilities, learner interaction data, and the Speak brand.',
      must_cover: ['learning content', 'conversational AI', 'learner data'],
      must_not_cover: []
    },
    KEY_ACTIVITIES: {
      ground_truth:
        'Key activities are improving the AI tutor, designing and localizing lessons, evaluating speech and feedback quality, operating the mobile product, and acquiring and retaining subscribers.',
      must_cover: ['AI tutor improvement', 'lesson design', 'subscriber retention'],
      must_not_cover: []
    },
    KEY_PARTNERSHIPS: {
      ground_truth:
        'Important partners include mobile app stores, cloud and AI infrastructure providers, payment processors, and language-content or localization contributors.',
      must_cover: ['app stores', 'AI infrastructure providers'],
      must_not_cover: []
    },
    COST_STRUCTURE: {
      ground_truth:
        'Major costs include AI inference and cloud infrastructure, product and machine-learning engineering, lesson and localization production, app-store fees, and consumer acquisition.',
      must_cover: ['AI inference', 'engineering', 'consumer acquisition'],
      must_not_cover: ['physical inventory']
    }
  },

  annotator_id: 'sheng-internal',
  annotation_quality: 'draft',
  notes: 'YC W17 edtech representative. Ground truth is based on the public YC company profile and Speak product materials.'
}
