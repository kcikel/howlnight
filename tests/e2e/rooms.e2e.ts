/**
 * Multi-device room E2E.
 * 1) Probe PeerJS broker + WebRTC from Chromium.
 * 2) If reachable: 1 host + 4 players through the real UI for one night+day.
 * 3) If not: full night+day via in-memory transport (Node), and report phones needed for real network.
 */
import { chromium, type Browser, type Page } from 'playwright'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import {
  createMemoryTransport,
  resetMemoryRooms,
  HostSession,
  PlayerSession,
  hostPeerId,
  buildNightSteps,
} from '../../src/net'

const BASE = 'http://127.0.0.1:4173/howlnight/'
const ROOT = join(import.meta.dirname, '../../dist')

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
}

function startStaticServer(port: number): Promise<() => Promise<void>> {
  const server = createServer((req, res) => {
    let url = req.url?.split('?')[0] ?? '/'
    if (url.startsWith('/howlnight')) url = url.slice('/howlnight'.length) || '/'
    let path = join(ROOT, url === '/' ? 'index.html' : url)
    if (!existsSync(path) || (existsSync(path) && statSync(path).isDirectory())) {
      path = join(ROOT, 'index.html')
    }
    try {
      const body = readFileSync(path)
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404)
      res.end('nope')
    }
  })
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(
        () =>
          new Promise((r) => {
            server.close(() => r())
          }),
      )
    })
  })
}

async function probePeerJs(browser: Browser): Promise<{ ok: boolean; detail: string }> {
  const page = await browser.newPage()
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const result = await page.evaluate(async () => {
      try {
        const idRes = await fetch('https://0.peerjs.com/peerjs/id')
        if (!idRes.ok) return { ok: false, detail: `id http ${idRes.status}` }
        const peerId = (await idRes.text()).trim()
        const wsOk = await new Promise<boolean>((resolve) => {
          const ws = new WebSocket(
            `wss://0.peerjs.com/peerjs?key=peerjs&id=hnprobe${Date.now().toString(36)}&token=tok`,
          )
          const t = setTimeout(() => {
            try { ws.close() } catch {}
            resolve(false)
          }, 10000)
          ws.onopen = () => {
            clearTimeout(t)
            ws.close()
            resolve(true)
          }
          ws.onerror = () => {
            clearTimeout(t)
            resolve(false)
          }
        })
        if (!wsOk) return { ok: false, detail: `ws failed (id mint ok ${peerId.slice(0, 8)})` }
        return { ok: true, detail: `broker reachable; ws open; id=${peerId.slice(0, 8)}` }
      } catch (e: any) {
        return { ok: false, detail: String(e?.message || e) }
      }
    })
    return result
  } finally {
    await page.close()
  }
}

async function memoryFullGame(): Promise<void> {
  resetMemoryRooms()
  const code = 'E2E1'
  const hostT = createMemoryTransport()
  await hostT.startHost(hostPeerId(code))
  const host = new HostSession(hostT, code, { hostName: 'Narrator' })
  await host.init()

  const names = ['Ada', 'Bea', 'Cal', 'Dee', 'Eve']
  const players: PlayerSession[] = []
  for (const name of names) {
    const t = createMemoryTransport()
    const p = new PlayerSession(t, code, { name })
    await p.connect(hostPeerId(code))
    players.push(p)
  }
  await new Promise((r) => setTimeout(r, 30))
  if (!host.canStart()) throw new Error('expected canStart with 6 seats')
  host.startGame(mulberry32(42))
  for (const s of host.getSnapshot().seats) host.markRevealed(s.id)
  host.beginFirstNight()
  host.advanceNightStep() // intro -> first role

  // Act through all night roles
  let guard = 0
  while (
    host.getSnapshot().game!.phase === 'night' ||
    host.getSnapshot().game!.phase === 'first_night_cupid'
  ) {
    const g = host.getSnapshot().game!
    const steps = buildNightSteps(g)
    const idx = host.getSnapshot().nightStepIndex
    const step = steps[idx]
    if (!step) break
    if (step.kind === 'intro' || step.kind === 'done') {
      host.advanceNightStep()
    } else if (step.kind === 'role' && step.role) {
      const actor = g.players.find((p) => p.alive && p.role === step.role)!
      const target = g.players.find((p) => p.alive && p.id !== actor.id)!
      if (step.role === 'cupid') {
        const pair = g.players.filter((p) => p.alive).slice(0, 2)
        host.submitNightAction(actor.id, { kind: 'cupid', pair: [pair[0].id, pair[1].id] })
      } else if (step.role === 'werewolf') {
        host.submitNightAction(actor.id, { kind: 'werewolf', targetId: target.id })
      } else if (step.role === 'seer') {
        host.submitNightAction(actor.id, { kind: 'seer', targetId: target.id })
      } else if (step.role === 'doctor') {
        host.submitNightAction(actor.id, { kind: 'doctor', targetId: target.id })
      } else if (step.role === 'spy') {
        host.submitNightAction(actor.id, { kind: 'spy', targetId: target.id })
      } else if (step.role === 'witch') {
        host.submitNightAction(actor.id, { kind: 'skip' })
      } else {
        host.advanceNightStep()
      }
    } else {
      host.advanceNightStep()
    }
    if (++guard > 40) throw new Error('night stuck')
  }

  if (host.getSnapshot().game!.phase === 'hunter_revenge') {
    const living = host.getSnapshot().game!.players.filter((p) => p.alive)
    host.applyHunterShot(living[0].id)
  }
  if (host.getSnapshot().game!.phase !== 'dawn' && host.getSnapshot().game!.phase !== 'game_over') {
    throw new Error(`expected dawn, got ${host.getSnapshot().game!.phase}`)
  }
  if (host.getSnapshot().game!.phase === 'game_over') {
    console.log('memory e2e: game ended at dawn (win) — ok')
    return
  }
  host.continueDawn()
  host.goToVote()
  const living = host.getSnapshot().game!.players.filter((p) => p.alive)
  const target = living[0]
  for (const p of living) {
    host.submitVote(p.id, p.id === target.id ? (living[1]?.id ?? 'skip') : target.id)
  }
  host.revealVotes()
  const phase = host.getSnapshot().game!.phase
  if (!['elimination', 'hunter_revenge', 'game_over'].includes(phase)) {
    throw new Error(`unexpected after vote: ${phase}`)
  }
  console.log('memory e2e: completed night+day, phase=', phase, 'players=', players.length + 1)
}


async function expectEnabled(locator: import('playwright').Locator) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  for (let i = 0; i < 20; i++) {
    if (await locator.isEnabled()) return
    await locator.page().waitForTimeout(250)
  }
  throw new Error('button stayed disabled: ' + (await locator.innerText()))
}

async function uiFullGame(browser: Browser): Promise<void> {
  const hostCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const host = await hostCtx.newPage()
  await host.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 })
  await host.getByRole('button', { name: /Create a room|Crear una sala|Criar uma sala/i }).click()
  await host.waitForSelector('.room-code', { timeout: 30000 })
  const code = (await host.locator('.room-code').innerText()).trim()
  console.log('UI e2e room code', code)
  // Host name field in lobby
  const hostNameInput = host.locator('.player-row input').first()
  await hostNameInput.fill('Narrator')
  await hostNameInput.blur()

  const playerPages: Page[] = []
  for (const name of ['Ada', 'Bea', 'Cal', 'Dee']) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.log('PLAYER ERR', name, e.message))
    await page.goto(`${BASE}?room=${code}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.locator('.room-input').nth(1).fill(name)
    await page.getByRole('button', { name: /Join|Entrar/i }).click()
    await page.locator('.room-code').or(page.getByText(/Waiting|Esperando|Esperando na sala|lobby/i)).first().waitFor({ timeout: 45000 })
    playerPages.push(page)
    console.log('joined', name)
  }

  // Wait until host lobby lists enough players (host + 4)
  await host.waitForFunction(() => document.querySelectorAll('.log-list li').length >= 5, null, {
    timeout: 45000,
  })
  console.log('lobby seats', await host.locator('.log-list li').count())
  const start = host.getByRole('button', { name: /Start game|Empezar partida|Começar jogo/i })
  await expectEnabled(start)
  await start.click()
  // Role reveal on all
  for (const page of [host, ...playerPages]) {
    try {
      await page.waitForSelector('.reveal-gate, .role-reveal', { timeout: 30000 })
    } catch (e) {
      console.log('REVEAL FAIL body', await page.locator('.app-shell').innerText().catch(()=>'no shell'))
      throw e
    }
    const gate = page.locator('.reveal-gate')
    if (await gate.count()) await gate.click()
  }
  await host.waitForTimeout(500)
  await host.getByRole('button', { name: /Let the night begin|Que empiece|Que a noite/i }).click()

  // Night intro
  await host.waitForSelector('text=/Night falls|La noche|A noite|Night has fallen|Cayó|caiu/i', {
    timeout: 20000,
  })
  const nextBtn = host.getByRole('button', { name: /Next|Siguiente|Próximo/i })
  if (await nextBtn.count()) await nextBtn.click()

  // Complete night: players act or host skips
  for (let i = 0; i < 12; i++) {
    const dawn = await host.locator('text=/Dawn|Amanecer|Amanhecer/i').count()
    if (dawn) break
    // Try confirm on any page that has action UI
    for (const page of [host, ...playerPages]) {
      const confirm = page.getByRole('button', { name: /Confirm|Confirmar/i })
      if (await confirm.count()) {
        const pick = page.locator('.player-pick button').first()
        if (await pick.count()) await pick.click()
        if (await confirm.isEnabled()) await confirm.click()
      }
      const skip = page.getByRole('button', { name: /Skip|Omitir|Pular/i })
      if (await skip.count()) {
        try {
          await skip.first().click({ timeout: 500 })
        } catch {}
      }
    }
    const hostSkip = host.getByRole('button', { name: /Skip this role|Saltar este rol|Pular este papel/i })
    if (await hostSkip.count()) await hostSkip.click()
    const cont = host.getByRole('button', { name: /Continue to day|Continuar al día|Continuar para o dia|Next|Siguiente/i })
    if (await cont.count()) {
      await cont.first().click()
    }
    await host.waitForTimeout(400)
  }

  // Dawn -> discuss -> vote (or already game_over after night)
  const hostText = async () => (await host.locator('.app-shell').innerText().catch(() => ''))
  console.log('post-night host UI:\n', await hostText())

  if (/game over|night is over|terminó|acabou|win/i.test(await hostText())) {
    console.log('UI e2e: completed night+day (ended at night resolution)')
    await hostCtx.close()
    return
  }

  const dawnContinue = host.getByRole('button', { name: /Day discussion|Discusión|Discussão/i })
  await dawnContinue.click({ timeout: 20000 })
  await host.getByRole('button', { name: /Go to vote|Ir a votar|Ir à votação/i }).click()
  await host.waitForTimeout(500)

  for (const page of [host, ...playerPages]) {
    const voteBtn = page.locator('.player-pick button').first()
    if (await voteBtn.count()) await voteBtn.click()
    else {
      const skip = page.getByRole('button', { name: /Skip|Abstener|Abster|abstain/i })
      if (await skip.count()) await skip.click()
    }
    await page.waitForTimeout(200)
  }
  await host.waitForTimeout(1000)
  console.log('pre-reveal host UI:\n', await hostText())
  const reveal = host.getByRole('button', { name: /Reveal elimination|Revelar eliminación|Revelar eliminação/i })
  await reveal.waitFor({ timeout: 20000 })
  await reveal.click()
  await host.waitForSelector(
    'text=/Eliminated|Eliminado|survived|acuerdo|acordo|game over|night is over|winners|Ganan|vencem/i',
    { timeout: 20000 },
  )
  console.log('UI e2e: completed night+day')
  console.log('final host UI:\n', await hostText())
  await hostCtx.close()
}

async function main() {
  if (!existsSync(join(ROOT, 'index.html'))) {
    throw new Error('dist/ missing — run npm run build first')
  }
  const stop = await startStaticServer(4173)
  const browser = await chromium.launch({ headless: true })
  const report: Record<string, unknown> = { signaling: null, memoryE2e: null, uiE2e: null }

  try {
    console.log('Probing PeerJS from Chromium…')
    const probe = await probePeerJs(browser)
    report.signaling = probe
    console.log('PeerJS probe:', probe)

    console.log('Running memory-transport full game…')
    await memoryFullGame()
    report.memoryE2e = 'passed'

    if (probe.ok) {
      console.log('Running Playwright UI multi-context e2e…')
      try {
        await uiFullGame(browser)
        report.uiE2e = 'passed'
      } catch (e) {
        report.uiE2e = `failed: ${e instanceof Error ? e.message : e}`
        console.error('UI e2e failed:', e)
      }
    } else {
      report.uiE2e = 'skipped — signaling not reachable from box; test on phones'
      console.log(report.uiE2e)
    }
  } finally {
    await browser.close()
    await stop()
  }

  console.log('E2E_REPORT', JSON.stringify(report, null, 2))
  if (report.memoryE2e !== 'passed') process.exit(1)
  if (report.uiE2e === 'passed' || String(report.uiE2e).startsWith('skipped')) process.exit(0)
  // UI attempted but failed — still exit 0 if memory passed? Prefer fail so we notice.
  process.exit(report.uiE2e === 'passed' ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
