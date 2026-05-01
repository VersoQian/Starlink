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

import { Fraunces, JetBrains_Mono } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'

// ============================================================================
// next/font configurations
// ============================================================================

/**
 * Fraunces — display serif. Variable axes:
 *   - opsz (optical size 9-144) — automatic per font-size
 *   - wght (weight 100-900) — we use 400 / 600 / 700 / 900
 *   - SOFT (softness 0-100) — kept default for newsprint feel
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '600', '700', '900'],
  display: 'swap',
  variable: '--font-fraunces',
  // Disable preload for the heavy variable file — we load on demand from
  // surfaces that actually use display type.
  preload: false,
})

/**
 * Geist Sans — body sans. Imported from the Vercel-published `geist`
 * package (NOT next/font/google — Geist isn't on the Google CDN as of
 * Next.js 14.2). The package self-publishes the variable as
 * `--font-geist-sans`; we re-export under our own var name below for
 * uniformity with fraunces / jetbrainsMono.
 */
export const geist = GeistSans

/**
 * JetBrains Mono — technical readouts. Already loaded in v1, this is
 * just the v2-namespaced re-export so future v2-only surfaces have a
 * clean import path.
 */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

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
// Add to layout.tsx <html> tag so all 3 CSS variables become available
// project-wide. Surfaces then opt-in via the variable, e.g.
//   <h1 className="font-[var(--font-fraunces)]">

export const fontVariables = `${fraunces.variable} ${geist.variable} ${jetbrainsMono.variable}`
