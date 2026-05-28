#!/usr/bin/env node
/**
 * Capture an extended set of screenshots referenced in
 * docs/paper/system-paper.md. Drives Chromium against the running
 * Next.js dev server (defaults to localhost:3000).
 *
 * Output: docs/paper/figures/screenshot-*.png
 *
 * Run with no args = capture every shot listed in CAPTURES below.
 * Run with `node capture-all-figures.mjs wizard knowledge` = only those.
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
const wantOnly = process.argv.slice(2)

const captured = []
const skipped = []

function picked(name) {
  return wantOnly.length === 0 || wantOnly.includes(name)
}

async function shot(page, name, opts = {}) {
  const file = resolve(FIG_DIR, `screenshot-${name}.png`)
  await page.screenshot({ path: file, fullPage: false, ...opts })
  captured.push({ name, size: opts.clip ? `${opts.clip.width}×${opts.clip.height}` : 'viewport' })
  console.log(`  ✓ screenshot-${name}.png`)
}

async function dismissTutorial(page) {
  for (let i = 0; i < 3; i++) {
    const skip = page.getByRole('button', { name: '跳过' })
    if (await skip.count() > 0 && await skip.first().isVisible().catch(() => false)) {
      await skip.first().click(); await page.waitForTimeout(300)
    } else break
  }
}

async function closeChatDock(page) {
  const close = page.locator('aside.absolute.left-4 button:has(svg.lucide-x)')
  if (await close.count() > 0) {
    await close.first().click().catch(() => {}); await page.waitForTimeout(300)
  }
}

async function gotoCanvas(page, mode /* '自由' | '九宫格' */, forceReload = false) {
  if (forceReload || !page.url().includes(`/canvas/${WORKSPACE_ID}`)) {
    await page.goto(`${APP_URL}/canvas/${WORKSPACE_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    await dismissTutorial(page)
    await closeChatDock(page)
  }
  if (mode) {
    await page.getByRole('button', { name: mode, exact: true }).first().click()
    await page.waitForTimeout(800)
  }
}

async function hideRightRailNoise(page) {
  await page.evaluate(() => {
    document
      .querySelectorAll('button[aria-label="结构化向导 · 7 步"], button[aria-label="查看长期记忆"], button[aria-label="打开 KB 资料"]')
      .forEach(b => { if (b.parentElement?.parentElement) b.parentElement.parentElement.style.display = 'none' })
    // hide the citation/evidence book button at right edge
    document.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect()
      if (b.querySelector('svg') && r.right > window.innerWidth - 60 && r.top > 200 && r.top < 400) {
        b.style.display = 'none'
      }
    })
  })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: 2200, height: 1400 },
    deviceScaleFactor: 2
  })
  const page = await ctx.newPage()

  console.log(`viewport 2200×1400 @ DPR 2`)
  console.log(`→ ${APP_URL}`)

  // ============================================================
  // BMC GRID — bigger zoom (user requested "稍微放大一点")
  // ============================================================
  if (picked('bmc-grid')) {
    await gotoCanvas(page, '九宫格')
    const collapse = page.getByRole('button', { name: '收起' })
    if (await collapse.count() > 0) await collapse.first().click().catch(() => {})
    await hideRightRailNoise(page)
    await page.waitForTimeout(500)

    const bounds = await page.evaluate(() => {
      const xp = document.evaluate("//*[contains(text(),'CC-BMC 商业模型画布')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      if (!xp.singleNodeValue) return null
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
    if (bounds) {
      const pad = 12
      await shot(page, 'stage-strip', {
        clip: {
          x: Math.max(0, Math.floor(bounds.x) - pad),
          y: Math.max(0, Math.floor(bounds.y) - pad - 30), // include sub-header band
          width: Math.min(2200, Math.ceil(bounds.w) + 2 * pad),
          height: Math.ceil(bounds.h) + 2 * pad + 30
        }
      })
    } else {
      skipped.push({ name: 'bmc-grid', reason: 'grid container not found' })
    }
  }

  // ============================================================
  // WIZARD 7-STEP — click 7步引导 then capture mid-flow
  // ============================================================
  if (picked('wizard')) {
    // The wizard entry on the existing workspace shows "READY" because the
    // workspace already has content. Trigger the wizard via the right-rail
    // "向导" button (aria-label = "结构化向导 · 7 步") instead.
    await gotoCanvas(page, '自由', true)
    await page.waitForTimeout(800)
    const wizBtn = page.locator('button[aria-label="结构化向导 · 7 步"]')
    if (await wizBtn.count() > 0) {
      await wizBtn.first().click().catch(() => {})
      await page.waitForTimeout(1500)
      await dismissTutorial(page) // tutorial may re-appear on wizard launch
      await page.waitForTimeout(600)
      // Open chat dock so wizard step content is visible
      const chatOpen = page.getByRole('button', { name: /打开对话/ })
      if (await chatOpen.count() > 0) {
        await chatOpen.first().click().catch(() => {})
        await page.waitForTimeout(900)
      }
      await shot(page, 'wizard-7step', {
        clip: { x: 0, y: 0, width: 900, height: 1400 }
      })
    } else {
      skipped.push({ name: 'wizard', reason: '结构化向导 button not in DOM' })
    }
  }

  // ============================================================
  // MEMORY PANEL — click 记忆 button
  // ============================================================
  if (picked('memory')) {
    await gotoCanvas(page, '自由', true)
    await closeChatDock(page)
    const memBtn = page.getByRole('button', { name: '查看长期记忆' })
    if (await memBtn.count() > 0) {
      await memBtn.first().click().catch(() => {})
      await page.waitForTimeout(900)
      await shot(page, 'memory-panel')
    } else {
      skipped.push({ name: 'memory', reason: '记忆 button not found' })
    }
  }

  // ============================================================
  // CARD DETAIL DRAWER — click 编辑卡片
  // ============================================================
  if (picked('card-detail')) {
    await gotoCanvas(page, '九宫格', true)
    await page.waitForTimeout(800)
    // Edit button only renders on hover — hover over a BMC card first.
    // Find the first card by its byline text.
    const card = page.locator('div:has-text("by Market_Agent"), div:has-text("by Product_Agent"), div:has-text("by Finance_Agent")').first()
    if (await card.count() > 0) {
      await card.hover().catch(() => {})
      await page.waitForTimeout(500)
    }
    // Now look for the now-visible edit button
    const editBtn = page.getByRole('button', { name: '编辑卡片' }).first()
    if (await editBtn.count() > 0) {
      const box = await editBtn.boundingBox()
      if (box && box.width > 0) {
        await editBtn.click({ force: true }).catch(() => {})
        await page.waitForTimeout(900)
        await shot(page, 'card-detail-drawer')
      } else {
        // Fallback: dispatch a click event programmatically
        const ok = await page.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === '编辑卡片')
          if (btn) { btn.click(); return true }
          return false
        })
        if (ok) {
          await page.waitForTimeout(900)
          await shot(page, 'card-detail-drawer')
        } else {
          skipped.push({ name: 'card-detail', reason: '编辑卡片 click failed' })
        }
      }
    } else {
      skipped.push({ name: 'card-detail', reason: '编辑卡片 not in DOM' })
    }
  }

  // ============================================================
  // KNOWLEDGE BASE UI
  // ============================================================
  if (picked('knowledge')) {
    await page.goto(`${APP_URL}/knowledge`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await dismissTutorial(page)
    await shot(page, 'knowledge-home')
  }

  // ============================================================
  // CHAT ENTRY (/chat)
  // ============================================================
  if (picked('chat-entry')) {
    await page.goto(`${APP_URL}/chat`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await dismissTutorial(page)
    await shot(page, 'chat-entry')
  }

  // ============================================================
  // READY CARD ZOOM (right-rail summary card)
  // ============================================================
  if (picked('ready-card')) {
    await gotoCanvas(page, '自由')
    const card = await page.evaluate(() => {
      // find the READY · 已有报告 card
      const xp = document.evaluate("//*[contains(text(),'READY')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      if (!xp.singleNodeValue) return null
      let el = xp.singleNodeValue
      while (el && el !== document.body) {
        const cls = typeof el.className === 'string' ? el.className : ''
        if (cls.includes('rounded') && cls.includes('shadow')) {
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        }
        el = el.parentElement
      }
      return null
    })
    if (card) {
      const pad = 24
      await shot(page, 'ready-card', {
        clip: {
          x: Math.max(0, Math.floor(card.x) - pad),
          y: Math.max(0, Math.floor(card.y) - pad),
          width: Math.min(2200, Math.ceil(card.w) + 2 * pad),
          height: Math.ceil(card.h) + 2 * pad
        }
      })
    } else {
      skipped.push({ name: 'ready-card', reason: 'READY card not found' })
    }
  }

  // ============================================================
  // CONDUCTOR ACTIVE (STAGE indicator + counters) — full top bar crop
  // ============================================================
  if (picked('boardroom-hud')) {
    await gotoCanvas(page, '九宫格')
    await shot(page, 'boardroom-hud', {
      clip: { x: 0, y: 0, width: 2200, height: 180 }
    })
  }

  // ============================================================
  // PERSPECTIVES TABS (top-center of freeform)
  // ============================================================
  if (picked('perspectives')) {
    await gotoCanvas(page, '自由')
    const tabs = await page.evaluate(() => {
      const xp = document.evaluate("//*[contains(text(),'Perspectives')]", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      if (!xp.singleNodeValue) return null
      let el = xp.singleNodeValue
      while (el && el !== document.body) {
        if (el.getAttribute('role') === 'tablist') {
          const r = el.getBoundingClientRect()
          return { x: r.x, y: r.y, w: r.width, h: r.height }
        }
        el = el.parentElement
      }
      return null
    })
    if (tabs) {
      const pad = 20
      await shot(page, 'perspectives-tabs', {
        clip: {
          x: Math.max(0, Math.floor(tabs.x) - pad),
          y: Math.max(0, Math.floor(tabs.y) - pad),
          width: Math.ceil(tabs.w) + 2 * pad,
          height: Math.ceil(tabs.h) + 2 * pad
        }
      })
    } else {
      skipped.push({ name: 'perspectives', reason: 'tablist not found' })
    }
  }

  await ctx.close()
  await browser.close()

  console.log(`\n=== captured ${captured.length} screenshots ===`)
  for (const c of captured) console.log(`  • ${c.name}  (${c.size})`)
  if (skipped.length) {
    console.log(`\n=== skipped ${skipped.length} ===`)
    for (const s of skipped) console.log(`  ✗ ${s.name}  (${s.reason})`)
  }
}

main().catch((err) => { console.error('CAPTURE FAILED:', err); process.exit(1) })
