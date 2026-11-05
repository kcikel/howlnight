import { chromium, type Page } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

// Usage: PREFIX=before|after BASE_URL=http://127.0.0.1:4173/ tsx scripts/redesign-shots.ts
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const PREFIX = process.env.PREFIX || 'after'
const OUT = process.env.OUT || '/workspace/howlnight/launch/redesign'
mkdirSync(OUT, { recursive: true })

async function shot(page: Page, name: string) {
  await page.waitForTimeout(700)
  await page.screenshot({ path: join(OUT, `${PREFIX}-${name}.png`) })
  console.log('saved', `${PREFIX}-${name}.png`)
}

async function fresh(browser: import('playwright').Browser) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    locale: 'en-US',
    reducedMotion: 'reduce',
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    localStorage.setItem('howlnight-lang', 'en')
    localStorage.setItem('howlnight-voice', '0')
  })
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  const sel = page.locator('select.select-lang')
  if (await sel.count()) await sel.selectOption('en').catch(() => {})
  await page.waitForTimeout(300)
  return { ctx, page }
}

async function main() {
  const browser = await chromium.launch()

  // Home
  {
    const { ctx, page } = await fresh(browser)
    await document_fonts(page)
    await shot(page, 'home')

    // Pass-the-phone -> setup -> role reveal
    await page.getByRole('button', { name: /Pass-the-phone/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^Continue$/i }).click()
    await page.waitForTimeout(300)
    await shot(page, 'role-pass')
    await page.locator('.reveal-gate').click()
    await shot(page, 'role-reveal')

    // reveal all
    for (let i = 0; i < 30; i++) {
      const gate = page.locator('.reveal-gate')
      if (await gate.count()) { await gate.click(); await page.waitForTimeout(80); continue }
      const start = page.getByRole('button', { name: /Let the night begin/i })
      if (await start.count()) { await start.click(); break }
      const hide = page.getByRole('button', { name: /Hide & pass/i })
      if (await hide.count()) { await hide.click(); await page.waitForTimeout(80); continue }
    }
    await page.waitForTimeout(300)
    // Night: advance through intro to the first role step
    const next = page.getByRole('button', { name: /^Next$/i })
    if (await next.count()) await next.first().click()
    await page.waitForTimeout(300)
    // select a target on werewolf step for a livelier frame
    const pick = page.locator('.player-pick button:not([disabled])')
    if (await pick.count()) await pick.first().click()
    await shot(page, 'night')

    // advance night
    for (let i = 0; i < 40; i++) {
      const cont = page.getByRole('button', { name: /Continue to day/i })
      if (await cont.count()) { await cont.click(); break }
      const skip = page.getByRole('button', { name: /^Skip$/i })
      if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(80); continue }
      const no = page.getByRole('button', { name: /^No$/i })
      if (await no.count()) { await no.first().click(); await page.waitForTimeout(80); continue }
      const nx = page.getByRole('button', { name: /^Next$/i })
      if (await nx.count()) { await nx.first().click(); await page.waitForTimeout(80); continue }
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(300)
    await shot(page, 'dawn')
    await page.getByRole('button', { name: /Day discussion/i }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /^Pause$/i }).click().catch(() => {})
    await shot(page, 'day')
    await ctx.close()
  }

  // Room lobby (host)
  {
    const { ctx, page } = await fresh(browser)
    await page.getByRole('button', { name: /Create a room/i }).click()
    try {
      await page.waitForSelector('.room-code', { timeout: 45000 })
      await page.addStyleTag({ content: '.panel p.muted[style*="word-break"]{visibility:hidden}' })
      const hostName = page.locator('.player-row input').first()
      if (await hostName.count()) { await hostName.fill('Host'); await hostName.blur() }
      await page.waitForTimeout(1500)
      await shot(page, 'lobby')
      await page.evaluate(() => window.scrollTo(0, 99999))
      await shot(page, 'lobby-roles')
    } catch (e) {
      console.error('lobby failed', e)
      await shot(page, 'lobby-error')
    }
    await ctx.close()
  }
  await browser.close()
}

async function document_fonts(page: Page) {
  await page.evaluate(async () => { await (document as any).fonts?.ready })
}

main().catch((e) => { console.error(e); process.exit(1) })
