/**
 * Programmatic full-game simulations including edge cases.
 * Run: npm run simulate
 */
import {
  beginNight,
  castVote,
  continueAfterElimination,
  createGame,
  finishNight,
  finishVote,
  hunterShoot,
  livingPlayers,
  presetForCount,
  setNightAction,
  startDayDiscuss,
  startDayVote,
  type GameState,
  type RoleId,
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
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player${i}` }))
}

function pickAlive(s: GameState, role?: RoleId, rng: () => number = Math.random) {
  const pool = livingPlayers(s).filter((p) => (role ? p.role === role : true))
  if (!pool.length) return undefined
  return pool[Math.floor(rng() * pool.length)]
}

function autoNight(s: GameState, rng: () => number): GameState {
  let st = s
  const wolves = livingPlayers(st).filter((p) => p.role === 'werewolf')
  const village = livingPlayers(st).filter((p) => p.role !== 'werewolf')
  if (wolves.length && village.length) {
    const target = village[Math.floor(rng() * village.length)]
    st = setNightAction(st, { werewolfTarget: target.id })
  }
  const seer = pickAlive(st, 'seer', rng)
  if (seer) {
    const t = livingPlayers(st).find((p) => p.id !== seer.id)
    if (t) st = setNightAction(st, { seerTarget: t.id })
  }
  const doc = pickAlive(st, 'doctor', rng)
  if (doc) {
    const t = pickAlive(st, undefined, rng)
    if (t) st = setNightAction(st, { doctorTarget: t.id })
  }
  const witch = pickAlive(st, 'witch', rng)
  if (witch && st.witch.healLeft && rng() > 0.5 && st.nightActions.werewolfTarget) {
    st = setNightAction(st, { witchHeal: true })
  } else if (witch && st.witch.poisonLeft && rng() > 0.7) {
    const t = village[Math.floor(rng() * village.length)]
    if (t) st = setNightAction(st, { witchPoisonTarget: t.id })
  }
  const spy = pickAlive(st, 'spy', rng)
  if (spy) {
    const t = livingPlayers(st).find((p) => p.id !== spy.id)
    if (t) st = setNightAction(st, { spyPeekTarget: t.id })
  }
  if (!st.cupidDone && st.players.some((p) => p.role === 'cupid')) {
    const alive = livingPlayers(st)
    if (alive.length >= 2) {
      const a = alive[0]
      const b = alive[1]
      st = setNightAction(st, { cupidPair: [a.id, b.id] })
    }
  }
  return finishNight(st)
}

function autoDay(s: GameState, rng: () => number): GameState {
  let st = startDayDiscuss(s)
  st = startDayVote(st)
  const living = livingPlayers(st)
  for (const voter of living) {
    const targets = living.filter((p) => p.id !== voter.id)
    const choice = rng() < 0.1 ? 'skip' : targets[Math.floor(rng() * targets.length)].id
    st = castVote(st, voter.id, choice as string | 'skip')
  }
  st = finishVote(st)
  if (st.phase === 'hunter_revenge') {
    const t = pickAlive(st, undefined, rng)
    if (t) st = hunterShoot(st, t.id)
  }
  if (st.phase === 'game_over') return st
  return continueAfterElimination(st)
}

function playGame(playerCount: number, seed: number, maxRounds = 30): GameState {
  const rng = mulberry32(seed)
  let s = createGame({ players: names(playerCount), roleCounts: presetForCount(playerCount) }, rng)
  s = beginNight(s)
  for (let i = 0; i < maxRounds; i++) {
    if (s.phase === 'game_over') break
    if (s.phase === 'first_night_cupid' || s.phase === 'night') {
      s = autoNight(s, rng)
    }
    if (s.phase === 'hunter_revenge') {
      const t = pickAlive(s, undefined, rng)
      if (t) s = hunterShoot(s, t.id)
    }
    if (s.phase === 'game_over') break
    if (s.phase === 'dawn' || s.phase === 'elimination') {
      if (s.phase === 'dawn') s = autoDay(s, rng)
      else s = continueAfterElimination(s)
    }
  }
  return s
}

const results: { seed: number; n: number; winner?: string; days: number; ok: boolean; note: string }[] = []

// Standard games
for (const n of [4, 5, 6, 8, 10, 12, 16, 20]) {
  for (let seed = 1; seed <= 5; seed++) {
    const s = playGame(n, seed * 100 + n)
    results.push({
      seed,
      n,
      winner: s.winner,
      days: s.day,
      ok: s.phase === 'game_over' && Boolean(s.winner),
      note: s.phase === 'game_over' ? 'finished' : `stuck:${s.phase}`,
    })
  }
}

// Edge: all heal forever-ish (doctor always saves wolf target) — still should end via votes
{
  const rng = mulberry32(777)
  let s = createGame({ players: names(6), roleCounts: presetForCount(6) }, rng)
  s = beginNight(s)
  for (let i = 0; i < 20 && s.phase !== 'game_over'; i++) {
    const village = livingPlayers(s).filter((p) => p.role !== 'werewolf')
    const target = village[0]
    if (target) s = setNightAction(s, { werewolfTarget: target.id, doctorTarget: target.id })
    s = finishNight(s)
    if (s.phase === 'game_over') break
    s = startDayDiscuss(s)
    s = startDayVote(s)
    const living = livingPlayers(s)
    const wolf = living.find((p) => p.role === 'werewolf')
    for (const v of living) {
      s = castVote(s, v.id, wolf && wolf.id !== v.id ? wolf.id : living.find((x) => x.id !== v.id)!.id)
    }
    s = finishVote(s)
    if (s.phase === 'hunter_revenge') {
      const t = livingPlayers(s)[0]
      if (t) s = hunterShoot(s, t.id)
    }
    if (s.phase !== 'game_over') s = continueAfterElimination(s)
  }
  results.push({
    seed: 777,
    n: 6,
    winner: s.winner,
    days: s.day,
    ok: s.phase === 'game_over',
    note: 'doctor-always-saves',
  })
}

const failed = results.filter((r) => !r.ok)
console.log(`Simulated ${results.length} games. Failed: ${failed.length}`)
const byWinner: Record<string, number> = {}
for (const r of results) {
  const w = r.winner ?? 'none'
  byWinner[w] = (byWinner[w] ?? 0) + 1
}
console.log('Winners:', byWinner)
console.log(
  'Sample:',
  results.slice(0, 8).map((r) => `${r.n}p seed${r.seed} → ${r.winner} d${r.days}`),
)
if (failed.length) {
  console.error('Failures:', failed)
  process.exit(1)
}
console.log('All simulations OK')
