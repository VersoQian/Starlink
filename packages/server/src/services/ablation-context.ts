/**
 * Per-request ablation context using AsyncLocalStorage.
 *
 * The runner previously used process.env to pass ablation flags (noCritic,
 * noDebate) into the business-langgraph pipeline. That works for sequential
 * execution but causes race conditions under concurrency — every run shares
 * the same global env, so one run's flags leak into another.
 *
 * AsyncLocalStorage gives each concurrent run its own isolated slot without
 * threading explicit arguments through every call chain.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface AblationFlags {
  noCritic: boolean
  noDebate: boolean
}

const store = new AsyncLocalStorage<AblationFlags>()

export const ablationContext = {
  /** Wrap an async function so flags are available to all nested calls. */
  run<R>(flags: AblationFlags, fn: () => Promise<R>): Promise<R> {
    return store.run(flags, fn)
  },

  /** Read the current ablation flags. Returns all-false when not inside a run(). */
  get(): AblationFlags {
    return store.getStore() ?? { noCritic: false, noDebate: false }
  }
}
