/**
 * Editorial Boardroom v2 typography stack (2026-05-01).
 *
 * Three font roles, no overlap:
 *
 *   Display serif → Fraunces (Google Fonts, OFL)
 *     Variable optical-size axis lets us use the SAME family for tiny
 *     bylines (8-10 px optical "soft" cut) AND big mastheads (72 px
 *     optical "sharp" cut) — that's distinctive vs. the 5-font sprawl
 *     this app currently has.
 *
 *   Body sans → Geist Sans (Google Fonts, OFL)
 *     Modern but NOT Inter. Designed by Vercel; geometry leans neutral
 *     instead of "humanist" so it doesn't fight Fraunces.
 *
 *   Technical mono → JetBrains Mono (Google Fonts, OFL — already loaded)
 *     Tabular numerals, slashed zero. Used for: agent ids, timestamps,
 *     token usage, citation [N] marks, any "instrument readout".
 *
 * REMOVAL TARGET (P4): Inter / Roboto / Outfit / Manrope / DM Sans —
 * the existing 5-font sprawl in globals.css. Once all surfaces opt
 * into v2, those imports go.
 */

import { GeistSans } from 'geist/font/sans'

// ============================================================================
// Font configurations
// ============================================================================
//
// Geist is loaded via the Vercel-published `geist` npm package (which
// ships its own font files — no network fetch at build time).
//
// Fraunces + JetBrains Mono are loaded via plain CSS `@import` in
// globals.css (browser-side fetch, deferred). Why not next/font/google
// for those? The build-time fetch from fonts.googleapis.com blocks
// compile when the dev environment has flaky upstream connectivity
// (observed 2026-05-01 in this env: Next dev server hangs >2 min on
// the first compile of a v2 route waiting on the font fetch retries).
// Browser-side @import lets the page render even when fonts haven't
// loaded yet — the user just sees the system fallback briefly.
//
// Both routes still use OFL-licensed Google Fonts; only the loader
// differs.

/**
 * Geist Sans — body sans. Bundled with the package, no network needed.
 * Self-publishes the variable as `--font-geist-sans`.
 */
export const geist = GeistSans

/**
 * Fraunces and JetBrains Mono CSS variables. The actual font CSS is
 * @imported in globals.css; these are the variable names that Tailwind
 * `font-display` / `font-instr` classes resolve to.
 */
export const cssFontVars = {
  fraunces:      '--font-fraunces',
  jetbrainsMono: '--font-jetbrains-mono',
} as const

// ============================================================================
// Font role classes — apply directly via className
// ============================================================================
//
// Usage:
//   <h1 className={`${typography.display} text-5xl`}>头版头条</h1>
//   <p  className={`${typography.body}    text-base`}>...</p>
//   <span className={`${typography.mono}  tabular-nums`}>12:34:56</span>

export const typography = {
  display: 'font-[var(--font-fraunces)] font-display',
  body:    'font-[var(--font-geist)]    font-sans',
  mono:    'font-[var(--font-jetbrains-mono)] font-mono',
} as const

// ============================================================================
// Type-scale ramps — newspaper convention
// ============================================================================
//
// Editorial layouts use FAR fewer sizes than typical UI design systems.
// We keep just 6: kicker / meta / body / lead / sub-head / display.

export const scale = {
  kicker:  '10px',  // mono UPPERCASE tracking-0.18em — section labels
  meta:    '11px',  // mono — timestamps, agent ids, byline rule
  body:    '14px',  // body sans — main reading
  lead:    '17px',  // body sans — emphasis paragraphs, masthead by-the-by
  subhead: '22px',  // display serif — cell titles
  display: '40px',  // display serif — masthead, cover headline
} as const

// ============================================================================
// All-in-one helper for layout root
// ============================================================================
//
// Add to layout.tsx <html> tag so the Geist CSS variable is available
// project-wide. Fraunces + JetBrains Mono variables are set via the
// :root selector in globals.css (no JS-side coupling needed).

export const fontVariables = geist.variable
