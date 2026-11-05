import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173'
const OUT = join('/workspace/howlnight/screens')
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, '01-landing.png'), fullPage: false })

  await page.getByRole('button', { name: /Start a night|Empezar|Começar/i }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, '02-setup.png'), fullPage: false })

  await page.getByRole('button', { name: /Continue|Continuar/i }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, '03-role-pass.png'), fullPage: false })

  // Reveal first role
  await page.locator('.reveal-gate').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, '04-role-reveal.png'), fullPage: false })

  // Go home via brand then Pro
  await page.locator('.brand').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Howlnight Pro/i }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, '05-pro.png'), fullPage: false })

  await browser.close()
  console.log('Screenshots saved to', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
