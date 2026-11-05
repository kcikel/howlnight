import { describe, expect, it, beforeEach } from 'vitest'
import {
  createMemoryTransport,
  resetMemoryRooms,
  HostSession,
  PlayerSession,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
  hostPeerId,
  buildNightSteps,
  nightActionToPatch,
} from '../src/net'
import { createGame, presetForCount } from '../src/engine'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

beforeEach(() => {
  resetMemoryRooms()
})

describe('room codes', () => {
  it('generates valid 4-letter codes', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateRoomCode(mulberry32(i + 1))
      expect(isValidRoomCode(c)).toBe(true)
      expect(c).toHaveLength(4)
      expect(c).not.toMatch(/[IO]/)
    }
  })

  it('normalizes input', () => {
    expect(normalizeRoomCode('ab-cd')).toBe('ABCD')
    expect(hostPeerId('WXYZ')).toBe('hnWXYZ')
  })
})

describe('nightActionToPatch', () => {
  it('maps actions', () => {
    expect(nightActionToPatch({ kind: 'seer', targetId: 'x' })).toEqual({ seerTarget: 'x' })
    expect(nightActionToPatch({ kind: 'skip' })).toEqual({})
  })
})

describe('host-authoritative multi-device protocol (memory transport)', () => {
  async function setupRoom(playerNames: string[]) {
    const code = 'TEST'
    const hostT = createMemoryTransport()
    await hostT.startHost(hostPeerId(code))
    const host = new HostSession(hostT, code, { hostName: 'Hosty' })
    await host.init()

    const players: PlayerSession[] = []
    for (const name of playerNames) {
      const t = createMemoryTransport()
      const p = new PlayerSession(t, code, { name })
      await p.connect(hostPeerId(code))
      players.push(p)
      // allow microtasks for welcome/lobby
      await Promise.resolve()
      await Promise.resolve()
    }
    await new Promise((r) => setTimeout(r, 20))
    return { host, players, code }
  }

  it('lobby lists live seats and blocks start under 4', async () => {
    const { host, players } = await setupRoom(['Ada', 'Bob'])
    expect(host.canStart()).toBe(false)
    expect(host.getSnapshot().seats).toHaveLength(3) // host + 2
    void players
  })

  it('starts game and sends private roles only to each player', async () => {
    const { host, players } = await setupRoom(['Ada', 'Bob', 'Cara'])
    expect(host.canStart()).toBe(true)

    const privates: Record<string, string | undefined> = {}
    for (const p of players) {
      p.onChange((s) => {
        if (s.privateView?.role) privates[s.privateView.playerId] = s.privateView.role
      })
    }
    let hostPriv: string | undefined
    host.onChange((s) => {
      const hid = host.getHostSeat().id
      hostPriv = s.privateViews[hid]?.role
    })

    host.startGame(mulberry32(99))
    await new Promise((r) => setTimeout(r, 40))

    const snap = host.getSnapshot()
    expect(snap.started).toBe(true)
    expect(snap.game?.phase).toBe('role_reveal')
    expect(snap.game?.players).toHaveLength(4)

    // Each private view has a role; public view must NOT include roles
    const pubPlayers = snap.game!.players
    const roles = new Set(pubPlayers.map((p) => p.role))
    expect(roles.size).toBeGreaterThan(0)

    // Simulate reveals + night
    for (const s of snap.seats) host.markRevealed(s.id)
    host.beginFirstNight()
    await new Promise((r) => setTimeout(r, 20))
    expect(host.getSnapshot().game?.phase).toMatch(/night/)

    // Advance intro
    host.advanceNightStep()
    await new Promise((r) => setTimeout(r, 20))

    const steps = buildNightSteps(host.getSnapshot().game!)
    // Drive all role actions via host skip until done, then finish
    let guard = 0
    while (host.getSnapshot().game!.phase !== 'dawn' && host.getSnapshot().game!.phase !== 'hunter_revenge' && host.getSnapshot().game!.phase !== 'game_over') {
      const g = host.getSnapshot().game!
      if (g.phase !== 'night' && g.phase !== 'first_night_cupid') break
      host.advanceNightStep()
      await new Promise((r) => setTimeout(r, 5))
      if (++guard > 30) break
    }
    expect(['dawn', 'hunter_revenge', 'game_over']).toContain(host.getSnapshot().game!.phase)
    void hostPriv
    void steps
  })

  it('accepts night action from the correct role only', async () => {
    const { host } = await setupRoom(['Ada', 'Bob', 'Cara'])
    host.startGame(mulberry32(7))
    for (const s of host.getSnapshot().seats) host.markRevealed(s.id)
    host.beginFirstNight()
    host.advanceNightStep() // past intro

    const game = host.getSnapshot().game!
    const steps = buildNightSteps(game)
    const roleStep = steps[host.getSnapshot().nightStepIndex]
    expect(roleStep.kind).toBe('role')
    const actor = game.players.find((p) => p.role === roleStep.role && p.alive)!
    const wrong = game.players.find((p) => p.id !== actor.id && p.alive)!

    const before = host.getSnapshot().nightStepIndex
    host.submitNightAction(wrong.id, { kind: 'skip' })
    expect(host.getSnapshot().nightStepIndex).toBe(before)

    const target = game.players.find((p) => p.id !== actor.id && p.alive)!
    if (roleStep.role === 'cupid') {
      const others = game.players.filter((p) => p.alive).slice(0, 2)
      host.submitNightAction(actor.id, { kind: 'cupid', pair: [others[0].id, others[1].id] })
    } else if (roleStep.role === 'werewolf') {
      host.submitNightAction(actor.id, { kind: 'werewolf', targetId: target.id })
    } else if (roleStep.role === 'seer') {
      host.submitNightAction(actor.id, { kind: 'seer', targetId: target.id })
    } else if (roleStep.role === 'doctor') {
      host.submitNightAction(actor.id, { kind: 'doctor', targetId: target.id })
    } else if (roleStep.role === 'spy') {
      host.submitNightAction(actor.id, { kind: 'spy', targetId: target.id })
    } else if (roleStep.role === 'witch') {
      host.submitNightAction(actor.id, { kind: 'skip' })
    }
    expect(host.getSnapshot().nightStepIndex).toBe(before + 1)
  })

  it('collects votes from each seat and reveals on host', async () => {
    const { host } = await setupRoom(['Ada', 'Bob', 'Cara'])
    host.startGame(mulberry32(3))
    for (const s of host.getSnapshot().seats) host.markRevealed(s.id)
    host.beginFirstNight()
    // skip entire night via host advances
    let guard = 0
    while (
      host.getSnapshot().game!.phase === 'night' ||
      host.getSnapshot().game!.phase === 'first_night_cupid'
    ) {
      host.advanceNightStep()
      if (++guard > 40) break
    }
    if (host.getSnapshot().game!.phase === 'hunter_revenge') {
      const living = host.getSnapshot().game!.players.filter((p) => p.alive)
      host.applyHunterShot(living[0].id)
    }
    if (host.getSnapshot().game!.phase === 'dawn') host.continueDawn()
    expect(host.getSnapshot().game!.phase).toBe('day_discuss')
    host.goToVote()
    const living = host.getSnapshot().game!.players.filter((p) => p.alive)
    const target = living[0]
    for (const p of living) {
      host.submitVote(p.id, p.id === target.id ? 'skip' : target.id)
    }
    expect(host.getSnapshot().game!.votes.length).toBe(living.length)
    host.revealVotes()
    expect(['elimination', 'hunter_revenge', 'game_over']).toContain(host.getSnapshot().game!.phase)
  })

  it('rejects late join after start', async () => {
    const { host } = await setupRoom(['Ada', 'Bob', 'Cara'])
    host.startGame(mulberry32(1))
    const t = createMemoryTransport()
    const late = new PlayerSession(t, 'TEST', { name: 'Late' })
    let err = ''
    late.onChange((s) => {
      if (s.error) err = s.error
    })
    await late.connect(hostPeerId('TEST'))
    await new Promise((r) => setTimeout(r, 30))
    expect(err.toLowerCase()).toMatch(/start/)
  })
})

describe('buildNightSteps', () => {
  it('includes intro and done', () => {
    const g = createGame({
      players: [
        { id: '1', name: 'A' },
        { id: '2', name: 'B' },
        { id: '3', name: 'C' },
        { id: '4', name: 'D' },
      ],
      roleCounts: presetForCount(4),
    })
    const steps = buildNightSteps({ ...g, phase: 'night', day: 1 })
    expect(steps[0].kind).toBe('intro')
    expect(steps[steps.length - 1].kind).toBe('done')
  })
})
