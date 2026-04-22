/**
 * Agent barrel entry. Importing this module registers all generation-team
 * agents via side-effect (each agent file calls `registerAgent` at module
 * top level).
 *
 * Wire-up pending (Day 5): the top-level supervisor graph will import from
 * here so the registry is populated before graph compilation.
 */

import './market-agent.js'
// TODO(Week 2): import './partnership-agent.js'
// TODO(Week 1 Day 5): import './product-agent.js'
// TODO(Week 1 Day 5): import './finance-agent.js'
// TODO(Week 1 Day 5): import './synthesizer.js'

export * from './market-agent.js'
