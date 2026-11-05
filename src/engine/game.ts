import { assignRoles } from './assign'
import { applyDawn, resolveNight } from './night'
import type { GameConfig, GameState, NightActions, RoleId } from './types'
import { applyHunterShot, resolveVote } from './vote'
import { checkWin } from './win'

export const DEFAULT_DISCUSS = 180
export const DISCUSS_OPTIONS = [60, 120, 180, 300] as const

export function createGame(config: GameConfig, rng: () => number = Math.random): GameState {
  const players = assignRoles(config, rng)
  const discussSeconds = config.discussSeconds ?? DEFAULT_DISCUSS
  return {
    players,
    phase: 'role_reveal',
    day: 0,
    witch: { healLeft: true, poisonLeft: true },
    nightActions: {},
    pendingDeaths: [],
    votes: [],
    log: [
      {
        day: 0,
        kind: 'special',
        text: `Game started with ${players.length} players.`,
      },
    ],
    cupidDone: false,
    discussSeconds,
  }
}

export function livingPlayers(state: GameState) {
  return state.players.filter((p) => p.alive)
}

export function playersWithRole(state: GameState, role: RoleId) {
  return state.players.filter((p) => p.alive && p.role === role)
}

export function beginNight(state: GameState): GameState {
  const hasCupid = state.players.some((p) => p.role === 'cupid' && p.alive)
  const firstCupid = hasCupid && !state.cupidDone
  return {
    ...state,
    day: state.day + 1,
    phase: firstCupid ? 'first_night_cupid' : 'night',
    nightActions: {},
    pendingDeaths: [],
    seerLastVision: undefined,
    spyLastPeek: undefined,
    littleGirlLastPeek: undefined,
  }
}

export function setNightAction(state: GameState, patch: Partial<NightActions>): GameState {
  return { ...state, nightActions: { ...state.nightActions, ...patch } }
}

export function finishNight(state: GameState): GameState {
  const resolved = resolveNight(state)
  const { state: dawnState, hunterNeedsRevenge } = applyDawn(resolved)
  if (hunterNeedsRevenge) {
    // Mark that revenge returns to dawn (day not started)
    return { ...dawnState, lastVoteVictim: undefined }
  }

  const winner = checkWin(dawnState)
  if (winner) return finishGame(dawnState, winner)
  return { ...dawnState, phase: 'dawn' }
}

export function startDayDiscuss(state: GameState): GameState {
  return { ...state, phase: 'day_discuss', votes: [] }
}

export function startDayVote(state: GameState): GameState {
  return { ...state, phase: 'day_vote', votes: [] }
}

export function castVote(state: GameState, voterId: string, targetId: string | 'skip'): GameState {
  const votes = state.votes.filter((v) => v.voterId !== voterId)
  votes.push({ voterId, targetId })
  return { ...state, votes }
}

export function finishVote(state: GameState): GameState {
  const { state: after, hunterNeedsRevenge } = resolveVote(state)
  if (hunterNeedsRevenge) return after
  const winner = checkWin(after)
  if (winner) return finishGame(after, winner)
  return after
}

export function hunterShoot(state: GameState, targetId: string): GameState {
  // If lastVoteVictim is set, revenge happened after a day vote → elimination screen.
  // Otherwise revenge happened after night deaths → show dawn, then day.
  const afterVote = Boolean(state.lastVoteVictim)
  let after = applyHunterShot(state, targetId)
  after = { ...after, phase: afterVote ? 'elimination' : 'dawn' }
  const winner = checkWin(after)
  if (winner) return finishGame(after, winner)
  return after
}

export function continueAfterElimination(state: GameState): GameState {
  const winner = checkWin(state)
  if (winner) return finishGame(state, winner)
  return beginNight(state)
}

function finishGame(state: GameState, winner: NonNullable<GameState['winner']>): GameState {
  const label =
    winner === 'wolves' ? 'The Werewolves' : winner === 'lovers' ? 'The Lovers' : 'The Village'
  return {
    ...state,
    phase: 'game_over',
    winner,
    log: [
      ...state.log,
      { day: state.day, kind: 'win', text: `${label} win the night.` },
    ],
  }
}

export function nightWakeOrder(state: GameState): RoleId[] {
  const aliveRoles = new Set(livingPlayers(state).map((p) => p.role))
  const order: { role: RoleId; order: number }[] = []
  const defs: RoleId[] = ['cupid', 'seer', 'spy', 'werewolf', 'littlegirl', 'doctor', 'witch']
  for (const role of defs) {
    if (!aliveRoles.has(role)) continue
    if (role === 'cupid' && state.cupidDone) continue
    const n =
      role === 'cupid'
        ? 10
        : role === 'seer'
          ? 20
          : role === 'spy'
            ? 25
            : role === 'werewolf'
              ? 30
              : role === 'littlegirl'
                ? 32
                : role === 'doctor'
                  ? 40
                  : 50
    order.push({ role, order: n })
  }
  return order.sort((a, b) => a.order - b.order).map((o) => o.role)
}
