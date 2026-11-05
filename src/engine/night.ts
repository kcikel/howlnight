import type { GameState, Player } from './types'

function byId(players: Player[], id?: string): Player | undefined {
  return id ? players.find((p) => p.id === id) : undefined
}

/**
 * Resolve night actions in classic order after all choices are recorded:
 * 1) Doctor protection
 * 2) Werewolf kill (blocked by protection or witch heal)
 * 3) Witch poison
 * Also applies cupid linking if present on first night.
 */
export function resolveNight(state: GameState): GameState {
  const players = state.players.map((p) => ({ ...p, protectedTonight: false }))
  const actions = { ...state.nightActions }
  const witch = { ...state.witch }
  const pendingDeaths: string[] = []
  const log = [...state.log]
  const day = state.day

  // Cupid linking (first night only)
  if (actions.cupidPair && !state.cupidDone) {
    const [a, b] = actions.cupidPair
    const pa = byId(players, a)
    const pb = byId(players, b)
    if (pa && pb && a !== b) {
      pa.loverOf = b
      pb.loverOf = a
      log.push({
        day,
        kind: 'special',
        text: `Cupid linked ${pa.name} and ${pb.name}.`,
      })
    }
  }

  // Doctor
  if (actions.doctorTarget) {
    const t = byId(players, actions.doctorTarget)
    if (t && t.alive) t.protectedTonight = true
  }

  // Seer vision (informational)
  let seerLastVision = state.seerLastVision
  if (actions.seerTarget) {
    const t = byId(players, actions.seerTarget)
    if (t) {
      seerLastVision = { targetId: t.id, isWolf: t.role === 'werewolf' }
    }
  }

  // Spy peek
  let spyLastPeek = state.spyLastPeek
  if (actions.spyPeekTarget) {
    const t = byId(players, actions.spyPeekTarget)
    if (t) spyLastPeek = { targetId: t.id, role: t.role }
  }

  // Werewolf attack
  let lastNightVictim: string | undefined
  const wolfTarget = byId(players, actions.werewolfTarget)
  let wolfKillBlocked = false
  if (wolfTarget && wolfTarget.alive) {
    if (wolfTarget.protectedTonight) {
      wolfKillBlocked = true
      log.push({ day, kind: 'night', text: `The wolves attacked ${wolfTarget.name}, but someone guarded them.` })
    } else if (actions.witchHeal && witch.healLeft) {
      wolfKillBlocked = true
      witch.healLeft = false
      log.push({ day, kind: 'night', text: `The Witch saved ${wolfTarget.name} from the wolves.` })
    } else {
      pendingDeaths.push(wolfTarget.id)
      lastNightVictim = wolfTarget.id
    }
  } else if (!wolfTarget) {
    log.push({ day, kind: 'night', text: 'The wolves prowled but chose no victim.' })
  }

  if (!wolfKillBlocked && lastNightVictim) {
    const v = byId(players, lastNightVictim)!
    log.push({ day, kind: 'night', text: `The wolves chose ${v.name}.` })
  }

  // Witch poison
  if (actions.witchPoisonTarget && witch.poisonLeft) {
    const t = byId(players, actions.witchPoisonTarget)
    if (t && t.alive && !pendingDeaths.includes(t.id)) {
      pendingDeaths.push(t.id)
      t.poisoned = true
      witch.poisonLeft = false
      log.push({ day, kind: 'night', text: `A mysterious poison was prepared.` })
    }
  }

  return {
    ...state,
    players,
    witch,
    pendingDeaths,
    lastNightVictim,
    seerLastVision,
    spyLastPeek,
    nightActions: {},
    cupidDone: state.cupidDone || Boolean(actions.cupidPair),
    log,
  }
}

/** Apply pending deaths at dawn, including lover chain and hunter flag. */
export function applyDawn(state: GameState): {
  state: GameState
  died: Player[]
  hunterNeedsRevenge: Player | undefined
} {
  const players = state.players.map((p) => ({ ...p }))
  const diedIds = new Set(state.pendingDeaths)
  const died: Player[] = []

  // Lover chain: if one lover dies, the other dies of grief
  for (const id of [...diedIds]) {
    const p = players.find((x) => x.id === id)
    if (p?.loverOf && !diedIds.has(p.loverOf)) {
      const other = players.find((x) => x.id === p.loverOf)
      if (other?.alive) diedIds.add(other.id)
    }
  }

  for (const id of diedIds) {
    const p = players.find((x) => x.id === id)
    if (p && p.alive) {
      p.alive = false
      died.push({ ...p })
    }
  }

  const hunterNeedsRevenge = died.find((p) => p.role === 'hunter')

  const names = died.map((p) => p.name)
  const log = [...state.log]
  if (names.length === 0) {
    log.push({ day: state.day, kind: 'dawn', text: 'Dawn breaks. Nobody died in the night.' })
  } else {
    log.push({
      day: state.day,
      kind: 'dawn',
      text: `Dawn breaks. Found dead: ${names.join(', ')}.`,
    })
  }

  return {
    state: {
      ...state,
      players,
      pendingDeaths: [],
      phase: hunterNeedsRevenge ? 'hunter_revenge' : 'dawn',
      log,
    },
    died,
    hunterNeedsRevenge,
  }
}
