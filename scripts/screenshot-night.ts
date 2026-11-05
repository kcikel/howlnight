import { chromium } from 'playwright'
import { join } from 'path'

async function main() {
  const OUT = '/workspace/howlnight/screens'
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Start a night/i }).click()
  await page.getByRole('button', { name: /Continue/i }).click()
  for (let i = 0; i < 6; i++) {
    await page.locator('.reveal-gate').click()
    await page.waitForTimeout(150)
    await page.getByRole('button', { name: /Hide & pass|Let the night begin/i }).click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, '06-night.png') })
  await browser.close()
  console.log('saved 06-night.png')
}
main()
