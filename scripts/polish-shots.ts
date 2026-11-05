import { chromium, type Browser, type Page } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

// PREFIX=after BASE_URL=http://localhost:4181/ [ONLY=home,role-reveal] [WIDTH=390 HEIGHT=844] tsx scripts/polish-shots.ts
const BASE = process.env.BASE_URL || 'http://localhost:4181/'
const PREFIX = process.env.PREFIX || 'after'
const OUT = process.env.OUT || '/workspace/howlnight/launch/polish'
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
const W = Number(process.env.WIDTH || 390)
const H = Number(process.env.HEIGHT || 844)
mkdirSync(OUT, { recursive: true })

async function shot(page: Page, name: string, full = false) {
  if (ONLY && !ONLY.has(name)) return
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${PREFIX}-${name}.png`), fullPage: full })
  console.log('saved', `${PREFIX}-${name}.png`)
}

async function fresh(browser: Browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    hasTouch: W < 700,
    isMobile: W < 700,
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  // Never send analytics from screenshot runs (also when shooting the live site).
  await ctx.route(/gc\.zgo\.at|goatcounter\.com/, (r) => r.abort())
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('howlnight-lang', 'en'))
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await page.evaluate(async () => { await (document as any).fonts?.ready })
  return { ctx, page }
}

const btn = (page: Page, re: RegExp) => page.getByRole('button', { name: re })

async function main() {
  const browser = await chromium.launch()
  {
    const { ctx, page } = await fresh(browser)
    await shot(page, 'home')
    await shot(page, 'home-full', true)
    await btn(page, /Rules/i).click()
    await shot(page, 'rules')
    await btn(page, /^Close$/i).first().click()
    await btn(page, /Pro \(coming soon\)/i).click()
    await shot(page, 'pro')
    await btn(page, /^Back$/i).click()

    await btn(page, /Pass-the-phone/i).click()
    await shot(page, 'setup')
    await btn(page, /^Continue$/i).click()
    await shot(page, 'role-pass')
    await page.locator('.reveal-gate').click()
    await shot(page, 'role-reveal')
    for (let i = 0; i < 30; i++) {
      if (await page.locator('.reveal-gate').count()) { await page.locator('.reveal-gate').click(); continue }
      if (await btn(page, /Let the night begin/i).count()) { await btn(page, /Let the night begin/i).click(); break }
      if (await btn(page, /Hide & pass/i).count()) { await btn(page, /Hide & pass/i).click(); continue }
    }
    await shot(page, 'night-intro')
    if (await btn(page, /^Next$/i).count()) await btn(page, /^Next$/i).first().click()
    await page.waitForTimeout(200)
    const pick = page.locator('.player-pick button:not([disabled])')
    if (await pick.count()) await pick.first().click()
    await shot(page, 'night')
    for (let i = 0; i < 40; i++) {
      if (await btn(page, /Continue to day/i).count()) { await btn(page, /Continue to day/i).click(); break }
      if (await btn(page, /^Skip$/i).count()) { await btn(page, /^Skip$/i).first().click(); continue }
      if (await btn(page, /^No$/i).count()) { await btn(page, /^No$/i).first().click(); continue }
      if (await btn(page, /^Next$/i).count()) { await btn(page, /^Next$/i).first().click(); continue }
      await page.waitForTimeout(100)
    }
    await shot(page, 'dawn')
    await btn(page, /Day discussion/i).click()
    await btn(page, /^Pause$/i).click().catch(() => {})
    await shot(page, 'day')
    await btn(page, /Go to vote/i).click()
    await shot(page, 'vote')
    for (let i = 0; i < 25; i++) {
      if (await btn(page, /Reveal elimination/i).count()) break
      const v = page.locator('.player-pick button')
      if (await v.count()) await v.first().click()
      await page.waitForTimeout(60)
    }
    await shot(page, 'vote-done')
    await btn(page, /Reveal elimination/i).click()
    await page.waitForTimeout(300)
    await shot(page, 'elimination')
    await ctx.close()
  }
  if (!ONLY || ONLY.has('lobby') || ONLY.has('player-lobby') || ONLY.has('join')) {
    const { ctx, page } = await fresh(browser)
    await btn(page, /Create a room/i).click()
    await page.waitForSelector('.room-code', { timeout: 45000 })
    await page.addStyleTag({ content: '.panel p.muted[style*="word-break"]{visibility:hidden}' })
    const hostName = page.locator('.player-row input').first()
    await hostName.fill('Mara'); await hostName.blur()
    const code = (await page.locator('.room-code').innerText()).replace(/\s/g, '')
    const p2 = await fresh(browser)
    await btn(p2.page, /Join with a code/i).click()
    await shot(p2.page, 'join')
    const inputs = p2.page.locator('.room-input')
    await inputs.nth(0).fill(code)
    await inputs.nth(1).fill('Ezra')
    await btn(p2.page, /^Join/i).last().click()
    try {
      await p2.page.waitForSelector('text=/Waiting|host/i', { timeout: 30000 })
      await p2.page.waitForTimeout(1500)
      await shot(p2.page, 'player-lobby')
    } catch (e) { console.error('player join failed', e) }
    await page.waitForTimeout(1500)
    await shot(page, 'lobby')
    await shot(page, 'lobby-full', true)
    await p2.ctx.close()
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
