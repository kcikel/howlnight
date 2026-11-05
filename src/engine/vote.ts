import type { DayVote, GameState, Player } from './types'

export function tallyVotes(votes: DayVote[]): { targetId: string | 'skip'; count: number }[] {
  const map = new Map<string | 'skip', number>()
  for (const v of votes) {
    map.set(v.targetId, (map.get(v.targetId) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([targetId, count]) => ({ targetId, count }))
    .sort((a, b) => b.count - a.count)
}

/** Eliminate the plurality target. Ties (including skip) → no elimination. */
export function resolveVote(state: GameState): {
  state: GameState
  eliminated: Player | undefined
  hunterNeedsRevenge: Player | undefined
} {
  const tallied = tallyVotes(state.votes)
  const top = tallied[0]
  const tie = tallied.length >= 2 && tallied[0].count === tallied[1].count

  if (!top || top.targetId === 'skip' || tie || top.count === 0) {
    const log = [
      ...state.log,
      {
        day: state.day,
        kind: 'vote' as const,
        text: tie
          ? 'The village could not agree. Nobody is eliminated.'
          : 'The village chose mercy. Nobody is eliminated.',
      },
    ]
    return {
      state: { ...state, votes: [], lastVoteVictim: undefined, log, phase: 'elimination' },
      eliminated: undefined,
      hunterNeedsRevenge: undefined,
    }
  }

  const players = state.players.map((p) => ({ ...p }))
  const victim = players.find((p) => p.id === top.targetId)
  if (!victim || !victim.alive) {
    return {
      state: { ...state, votes: [], phase: 'elimination' },
      eliminated: undefined,
      hunterNeedsRevenge: undefined,
    }
  }

  victim.alive = false
  const died: Player[] = [{ ...victim }]

  // Lover grief
  if (victim.loverOf) {
    const other = players.find((p) => p.id === victim.loverOf)
    if (other?.alive) {
      other.alive = false
      died.push({ ...other })
    }
  }

  const hunterNeedsRevenge = died.find((p) => p.role === 'hunter')
  const log = [
    ...state.log,
    {
      day: state.day,
      kind: 'vote' as const,
      text: `The village eliminated ${died.map((d) => `${d.name} (${d.role})`).join(' and ')}.`,
    },
  ]

  return {
    state: {
      ...state,
      players,
      votes: [],
      lastVoteVictim: victim.id,
      log,
      phase: hunterNeedsRevenge ? 'hunter_revenge' : 'elimination',
    },
    eliminated: victim,
    hunterNeedsRevenge,
  }
}

export function applyHunterShot(state: GameState, targetId: string): GameState {
  const players = state.players.map((p) => ({ ...p }))
  const t = players.find((p) => p.id === targetId && p.alive)
  const log = [...state.log]
  if (t) {
    t.alive = false
    log.push({
      day: state.day,
      kind: 'special',
      text: `The Hunter's dying shot took down ${t.name} (${t.role}).`,
    })
    if (t.loverOf) {
      const other = players.find((p) => p.id === t.loverOf)
      if (other?.alive) {
        other.alive = false
        log.push({
          day: state.day,
          kind: 'special',
          text: `${other.name} died of a broken heart.`,
        })
      }
    }
  }
  return { ...state, players, log, phase: 'elimination' }
}
