import { describe, expect, it } from 'vitest'
import {
  adjustRole,
  applyDawn,
  assignRoles,
  castVote,
  checkWin,
  createGame,
  finishNight,
  finishVote,
  hunterShoot,
  presetForCount,
  resolveNight,
  setNightAction,
  tallyVotes,
  totalRoles,
} from '../src/engine'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function names(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }))
}

describe('presets', () => {
  it('fills exact player counts 4–20', () => {
    for (let n = 4; n <= 20; n++) {
      const p = presetForCount(n)
      expect(totalRoles(p)).toBe(n)
      expect(p.werewolf).toBeGreaterThanOrEqual(1)
    }
  })

  it('adjustRole keeps total equal to players', () => {
    const base = presetForCount(10)
    const next = adjustRole(base, 'seer', 0, 10) // no-op
    expect(totalRoles(next)).toBe(10)
    const up = adjustRole(base, 'werewolf', 1, 10)
    expect(totalRoles(up)).toBe(10)
  })
})

describe('role assignment', () => {
  it('assigns exact role multiset', () => {
    const counts = { werewolf: 2, villager: 3, seer: 1, doctor: 1 }
    const players = assignRoles({ players: names(7), roleCounts: counts }, mulberry32(42))
    expect(players).toHaveLength(7)
    const tally: Record<string, number> = {}
    for (const p of players) tally[p.role] = (tally[p.role] ?? 0) + 1
    expect(tally).toEqual(counts)
  })

  it('is deterministic with seed', () => {
    const cfg = { players: names(8), roleCounts: presetForCount(8) }
    const a = assignRoles(cfg, mulberry32(7)).map((p) => p.role)
    const b = assignRoles(cfg, mulberry32(7)).map((p) => p.role)
    expect(a).toEqual(b)
  })

  it('rejects mismatched counts', () => {
    expect(() =>
      assignRoles({ players: names(5), roleCounts: { werewolf: 1, villager: 1 } }),
    ).toThrow()
  })
})

describe('night resolution', () => {
  function baseState() {
    return createGame(
      {
        players: names(7),
        roleCounts: { werewolf: 1, villager: 3, seer: 1, doctor: 1, witch: 1 },
      },
      mulberry32(99),
    )
  }

  it('doctor saves the wolf target', () => {
    let s = baseState()
    const wolf = s.players.find((p) => p.role === 'werewolf')!
    const victim = s.players.find((p) => p.role === 'villager')!
    const doc = s.players.find((p) => p.role === 'doctor')!
    expect(doc).toBeTruthy()
    s = setNightAction(s, { werewolfTarget: victim.id, doctorTarget: victim.id })
    s = resolveNight(s)
    expect(s.pendingDeaths).not.toContain(victim.id)
    const dawn = applyDawn(s)
    expect(dawn.died).toHaveLength(0)
    expect(dawn.state.players.find((p) => p.id === victim.id)!.alive).toBe(true)
    void wolf
  })

  it('witch heal blocks the kill and consumes potion', () => {
    let s = baseState()
    const victim = s.players.find((p) => p.role === 'villager')!
    s = setNightAction(s, { werewolfTarget: victim.id, witchHeal: true })
    s = resolveNight(s)
    expect(s.witch.healLeft).toBe(false)
    expect(s.pendingDeaths).not.toContain(victim.id)
  })

  it('witch poison kills a second target', () => {
    let s = baseState()
    const villagers = s.players.filter((p) => p.role === 'villager')
    const v1 = villagers[0]
    const v2 = villagers[1]
    s = setNightAction(s, { werewolfTarget: v1.id, witchPoisonTarget: v2.id })
    s = resolveNight(s)
    expect(s.pendingDeaths.sort()).toEqual([v1.id, v2.id].sort())
    expect(s.witch.poisonLeft).toBe(false)
  })

  it('cupid links lovers and grief chain works', () => {
    let s = createGame(
      {
        players: names(9),
        roleCounts: presetForCount(9),
      },
      mulberry32(3),
    )
    const a = s.players[0]
    const b = s.players[1]
    s = setNightAction(s, {
      cupidPair: [a.id, b.id],
      werewolfTarget: a.id,
    })
    s = finishNight(s)
    expect(s.players.find((p) => p.id === a.id)!.alive).toBe(false)
    expect(s.players.find((p) => p.id === b.id)!.alive).toBe(false)
  })
})

describe('voting & win', () => {
  it('tally sorts by count', () => {
    const t = tallyVotes([
      { voterId: '1', targetId: 'a' },
      { voterId: '2', targetId: 'b' },
      { voterId: '3', targetId: 'a' },
    ])
    expect(t[0]).toEqual({ targetId: 'a', count: 2 })
  })

  it('village wins when wolves are gone', () => {
    let s = createGame(
      { players: names(5), roleCounts: { werewolf: 1, villager: 3, seer: 1 } },
      mulberry32(1),
    )
    const wolf = s.players.find((p) => p.role === 'werewolf')!
    for (const p of s.players.filter((x) => x.alive && x.id !== wolf.id)) {
      s = castVote(s, p.id, wolf.id)
    }
    s = { ...s, phase: 'day_vote' }
    s = finishVote(s)
    expect(s.winner).toBe('village')
    expect(s.phase).toBe('game_over')
  })

  it('wolves win when they outnumber village', () => {
    const players = names(4).map((p, i) => ({
      ...p,
      role: (i < 2 ? 'werewolf' : 'villager') as const,
      alive: true,
    }))
    // kill one villager so 2 wolves vs 1 villager
    players[3].alive = false
    const state = {
      players,
      phase: 'dawn' as const,
      day: 1,
      witch: { healLeft: true, poisonLeft: true },
      nightActions: {},
      pendingDeaths: [],
      votes: [],
      log: [],
      cupidDone: true,
      discussSeconds: 180,
    }
    expect(checkWin(state)).toBe('wolves')
  })

  it('lovers win when only the pair remains', () => {
    const players = names(4).map((p, i) => ({
      id: p.id,
      name: p.name,
      role: (i === 0 ? 'werewolf' : 'villager') as const,
      alive: i < 2,
      loverOf: i === 0 ? 'p1' : i === 1 ? 'p0' : undefined,
    }))
    const state = {
      players,
      phase: 'dawn' as const,
      day: 2,
      witch: { healLeft: false, poisonLeft: false },
      nightActions: {},
      pendingDeaths: [],
      votes: [],
      log: [],
      cupidDone: true,
      discussSeconds: 180,
    }
    expect(checkWin(state)).toBe('lovers')
  })

  it('hunter revenge eliminates a target', () => {
    let s = createGame(
      {
        players: names(8),
        roleCounts: { werewolf: 2, villager: 3, seer: 1, doctor: 1, hunter: 1 },
      },
      mulberry32(11),
    )
    const hunter = s.players.find((p) => p.role === 'hunter')!
    const other = s.players.find((p) => p.alive && p.id !== hunter.id)!
    // Force hunter dead via night
    s = setNightAction(s, { werewolfTarget: hunter.id })
    s = finishNight(s)
    expect(s.phase).toBe('hunter_revenge')
    s = hunterShoot(s, other.id)
    expect(s.players.find((p) => p.id === other.id)!.alive).toBe(false)
  })
})

describe('little girl', () => {
  it('is in presets at 11+', () => {
    const p = presetForCount(11)
    expect(p.littlegirl).toBe(1)
    expect(totalRoles(p)).toBe(11)
  })

  it('records peek and may die when peeking a wolf', () => {
    const state = createGame(
      {
        players: names(6),
        roleCounts: { werewolf: 1, villager: 3, seer: 1, littlegirl: 1 },
      },
      mulberry32(99),
    )
    const girl = state.players.find((p) => p.role === 'littlegirl')!
    const wolf = state.players.find((p) => p.role === 'werewolf')!
    const villager = state.players.find((p) => p.role === 'villager' && p.id !== girl.id)!
    let deaths = 0
    for (let i = 0; i < 50; i++) {
      const patched = setNightAction(state, {
        werewolfTarget: villager.id,
        littleGirlPeekTarget: wolf.id,
      })
      const resolved = resolveNight(patched)
      expect(resolved.littleGirlLastPeek?.isWolf).toBe(true)
      if (resolved.pendingDeaths.includes(girl.id)) deaths++
    }
    expect(deaths).toBeGreaterThan(0)
    expect(deaths).toBeLessThan(50)
  })

  it('safe peek on villager never catches', () => {
    const state = createGame(
      {
        players: names(6),
        roleCounts: { werewolf: 1, villager: 3, seer: 1, littlegirl: 1 },
      },
      mulberry32(3),
    )
    const villager = state.players.find((p) => p.role === 'villager')!
    const girl = state.players.find((p) => p.role === 'littlegirl')!
    for (let i = 0; i < 20; i++) {
      const patched = setNightAction(state, {
        werewolfTarget: villager.id,
        littleGirlPeekTarget: state.players.find((p) => p.role === 'seer')!.id,
      })
      const resolved = resolveNight(patched)
      expect(resolved.littleGirlLastPeek?.isWolf).toBe(false)
      expect(resolved.littleGirlLastPeek?.caught).toBe(false)
      expect(resolved.pendingDeaths.includes(girl.id)).toBe(false)
    }
  })
})

describe('discussSeconds config', () => {
  it('honors custom discussSeconds', () => {
    const g = createGame({
      players: names(4),
      roleCounts: { werewolf: 1, villager: 2, seer: 1 },
      discussSeconds: 60,
    })
    expect(g.discussSeconds).toBe(60)
  })
})
