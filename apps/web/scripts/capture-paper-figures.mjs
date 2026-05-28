#!/usr/bin/env node
/**
 * Capture screenshots referenced as `<!-- SCREENSHOT PENDING -->` in
 * docs/paper/system-paper.md. Drives Chromium against the running
 * Next.js dev server (defaults to localhost:3000).
 *
 * Output: docs/paper/figures/screenshot-*.png
 *
 * Usage:
 *   node apps/web/scripts/capture-paper-figures.mjs [shot ...]
 *
 * Env:
 *   APP_URL          dev-server origin (default http://localhost:3000)
 *   WORKSPACE_ID     canvas workspace id to load (default proj-001)
 *
 * If shot names are passed as args, only those shots run; otherwise all.
 * Known shots: canvas-freeform, stage-strip, boardroom-hud,
 *              timeline, agent-health, citation-flow, dual-mode
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIG_DIR = resolve(__dirname, '..', '..', '..', 'docs', 'paper', 'figures')
mkdirSync(FIG_DIR, { recursive: true })

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const WORKSPACE_ID = process.env.WORKSPACE_ID ?? 'proj-001'

const wantShots = process.argv.slice(2)
const want = (n) => wantShots.length === 0 || wantShots.includes(n)

const SHOTS = []
async function shot(page, name, opts = {}) {
  const file = resolve(FIG_DIR, `screenshot-${name}.png`)
  await page.screenshot({ path: file, fullPage: false, ...opts })
  SHOTS.push({ name, file, size: opts.clip ? `${opts.clip.width}×${opts.clip.height}` : 'viewport' })
  console.log(`  ✓ screenshot-${name}.png`)
}

async function dismissTutorial(page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: '跳过' })
    if (await skip.count() > 0 && await skip.first().isVisible().catch(() => false)) {
      await skip.first().click()
      await page.waitForTimeout(400)
    } else { break }
  }
}

async function closeChatDock(page) {
  const close = page.locator('aside.absolute.left-4 button:has(svg.lucide-x)')
  if (await close.count() > 0) {
    await close.first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function setMode(page, mode /* '自由' | '九宫格' */) {
  await page.getByRole('button', { name: mode, exact: true }).first().click()
  await page.waitForTimeout(800)
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()

  console.log(`→ ${APP_URL}/canvas/${WORKSPACE_ID}`)
  await page.goto(`${APP_URL}/canvas/${WORKSPACE_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await dismissTutorial(page)
  await closeChatDock(page)
  await page.waitForTimeout(800)

  // ===== Figure 4-3 / dual-mode left half: canvas-freeform =====
  if (want('canvas-freeform') || want('dual-mode')) {
    await setMode(page, '自由')
    await page.waitForTimeout(800)
    if (want('canvas-freeform')) await shot(page, 'canvas-freeform')
    if (want('dual-mode')) await shot(page, 'dual-mode-freeform')
  }

  // ===== Figure 4-3c · Timeline history panel =====
  if (want('timeline')) {
    await setMode(page, '自由')
    // Click the Timeline tab (top center)
    const timelineTab = page.getByRole('button', { name: 'Timeline', exact: true })
    if (await timelineTab.count() > 0) {
      await timelineTab.first().click()
      await page.waitForTimeout(900)
      await shot(page, 'execution-timeline')
    } else {
      console.log('  ⚠ Timeline tab not found — falling back to opening history panel button')
    }
    // Switch back to Perspectives so other shots aren't affected
    const perspTab = page.getByRole('button', { name: 'Perspectives', exact: true })
    if (await perspTab.count() > 0) await perspTab.first().click()
    await page.waitForTimeout(400)
  }

  // ===== Figure 4-4a / stage-strip / dual-mode right half: 九宫格 =====
  if (want('stage-strip') || want('dual-mode')) {
    await setMode(page, '九宫格')
    await page.waitForTimeout(1200)
    if (want('stage-strip')) await shot(page, 'stage-strip')
    if (want('dual-mode')) await shot(page, 'dual-mode-grid')
  }

  // ===== Figure 4-3a · Editorial-boardroom HUD top bar =====
  if (want('boardroom-hud')) {
    await shot(page, 'boardroom-hud', { clip: { x: 0, y: 0, width: 1440, height: 130 } })
  }

  // ===== Figure 4-4 · Agent-health chip expanded =====
  if (want('agent-health')) {
    await setMode(page, '九宫格')
    await page.waitForTimeout(600)
    const healthBtn = page.getByRole('button', { name: /(Agent SLO health panel|agent\(s\) degraded)/i })
    if (await healthBtn.count() > 0) {
      await healthBtn.first().click()
      await page.waitForTimeout(700)
      // Crop the bottom-right area where the expanded panel lives
      await shot(page, 'agent-health', {
        clip: { x: 900, y: 350, width: 540, height: 550 }
      })
      // Close the panel
      const closeBtn = page.getByRole('button', { name: 'Close' })
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click().catch(() => {})
      }
    } else {
      console.log('  ⚠ Agent-health chip not found on canvas')
    }
    await page.waitForTimeout(300)
  }

  // ===== Figure 3-7b · Citation chip → evidence drawer =====
  if (want('citation-flow')) {
    await setMode(page, '九宫格')
    await page.waitForTimeout(800)
    // Citation chips are rendered as inline buttons or links inside cards.
    // Common forms: a button containing "[引用]" or with title attribute.
    const chip = page.locator('button:has-text("引用"), button[title*="引用"], button[aria-label*="引用"]').first()
    if (await chip.count() > 0 && await chip.isVisible().catch(() => false)) {
      await chip.click().catch(() => {})
      await page.waitForTimeout(900)
      await shot(page, 'citation-flow')
    } else {
      // Fallback: click on a card to open the cell-detail drawer (which itself shows citations)
      const cellEdit = page.getByRole('button', { name: '编辑卡片' }).first()
      if (await cellEdit.count() > 0) {
        await cellEdit.click().catch(() => {})
        await page.waitForTimeout(900)
        await shot(page, 'citation-flow')
      } else {
        console.log('  ⚠ No citation chip and no 编辑卡片 button found')
      }
    }
  }

  await ctx.close()
  await browser.close()

  console.log(`\nWrote ${SHOTS.length} screenshots to ${FIG_DIR}`)
  for (const s of SHOTS) console.log(`  • screenshot-${s.name}.png  (${s.size})`)
}

main().catch((err) => {
  console.error('CAPTURE FAILED:', err)
  process.exit(1)
})
