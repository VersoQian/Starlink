#!/usr/bin/env node
/**
 * Capture a LARGER, TIGHTER screenshot of the populated 9-cell BMC grid
 * for Figure 4-4a. Strategy:
 *   1. Use a wider viewport (1920×1200) so each cell gets more pixels.
 *   2. Collapse the READY card (top-right) via its 收起 button.
 *   3. Crop tightly around the grid container so right-rail buttons and
 *      surrounding chrome are removed.
 *
 * Output: docs/paper/figures/screenshot-stage-strip.png (overwrites)
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

async function dismiss(page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: '跳过' })
    if (await skip.count() > 0 && await skip.first().isVisible().catch(() => false)) {
      await skip.first().click(); await page.waitForTimeout(300)
    } else break
  }
  const close = page.locator('aside.absolute.left-4 button:has(svg.lucide-x)')
  if (await close.count() > 0) { await close.first().click().catch(() => {}); await page.waitForTimeout(300) }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2
  })
  const page = await ctx.newPage()

  console.log(`→ ${APP_URL}/canvas/${WORKSPACE_ID} (1920×1200 viewport)`)
  await page.goto(`${APP_URL}/canvas/${WORKSPACE_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await dismiss(page)
  await page.waitForTimeout(500)

  // Switch to 九宫格
  await page.getByRole('button', { name: '九宫格', exact: true }).first().click()
  await page.waitForTimeout(1200)

  // Collapse the READY card (top-right) using its "收起" button
  const collapse = page.getByRole('button', { name: '收起' })
  if (await collapse.count() > 0) {
    await collapse.first().click().catch(() => {})
    await page.waitForTimeout(400)
    console.log('  · collapsed READY card')
  }

  // Optionally hide the right-rail nav by removing the buttons (向导/记忆/资料/book)
  // — we do this client-side so the chrome doesn't intrude on the grid clip.
  await page.evaluate(() => {
    document.querySelectorAll('button[aria-label="结构化向导 · 7 步"], button[aria-label="查看长期记忆"], button[aria-label="打开 KB 资料"]').forEach(b => { b.parentElement?.parentElement?.style && (b.parentElement.parentElement.style.display = 'none') })
    // Hide the book icon (right edge)
    document.querySelectorAll('button').forEach(b => {
      const svg = b.querySelector('svg')
      if (!svg) return
      const r = b.getBoundingClientRect()
      if (r.right > window.innerWidth - 60 && r.top > 200 && r.top < 400) {
        b.style.display = 'none'
      }
    })
  })
  await page.waitForTimeout(300)

  // Measure the BMC grid container
  const bounds = await page.evaluate(() => {
    // The grid container is the div containing "CC-BMC 商业模型画布"
    const xp = document.evaluate("//*[contains(text(),'CC-BMC 商业模型画布')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
    if (!xp.singleNodeValue) return null
    // walk up until we find the rounded-2xl container (the white card with shadow)
    let el = xp.singleNodeValue
    while (el && el !== document.body) {
      const cls = typeof el.className === 'string' ? el.className : ''
      if (cls.includes('rounded-2xl') && cls.includes('shadow')) {
        const r = el.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      }
      el = el.parentElement
    }
    return null
  })

  if (!bounds) {
    console.error('Could not locate BMC grid container — falling back to full viewport')
    await page.screenshot({ path: resolve(FIG_DIR, 'screenshot-stage-strip.png') })
  } else {
    // Include a small slice ABOVE the grid container so the 5-stage pipeline strip
    // (which sits in the page header) is also captured.
    const stripHeight = Math.round(bounds.y) // everything above the grid
    const pad = 16
    const clip = {
      x: Math.max(0, Math.floor(bounds.x) - pad),
      y: 0,
      width: Math.min(1920 - Math.max(0, Math.floor(bounds.x) - pad), Math.ceil(bounds.w) + 2 * pad),
      height: Math.ceil(bounds.h) + stripHeight + pad
    }
    console.log(`  · grid bounds: ${JSON.stringify(bounds)}`)
    console.log(`  · capture clip: ${JSON.stringify(clip)}`)
    await page.screenshot({
      path: resolve(FIG_DIR, 'screenshot-stage-strip.png'),
      clip
    })
  }

  await ctx.close()
  await browser.close()
  console.log('Wrote screenshot-stage-strip.png')
}

main().catch((err) => { console.error('CAPTURE FAILED:', err); process.exit(1) })
