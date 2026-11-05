import {
  livingPlayers,
  nightWakeOrder,
  playersWithRole,
  type GameState,
  type RoleId,
} from '../engine'
import type { LobbySeat, NightStepKind, PrivateGameView, PublicGameView, PublicPlayer } from './types'

export interface NightUiStep {
  kind: NightStepKind
  role?: RoleId
}

export function buildNightSteps(state: GameState): NightUiStep[] {
  const order = nightWakeOrder(state)
  return [{ kind: 'intro' }, ...order.map((role) => ({ kind: 'role' as const, role })), { kind: 'done' }]
}

export function publicPlayers(
  state: GameState,
  connected: Set<string>,
): PublicPlayer[] {
  return state.players.map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    connected: connected.has(p.id),
  }))
}

export function buildPublicView(opts: {
  state: GameState
  connected: Set<string>
  nightStepIndex: number
  discussEndsAt?: number
  discussPaused: boolean
  dawnDied?: PublicGameView['dawnDied']
  eliminated?: PublicGameView['eliminated']
}): PublicGameView {
  const { state, connected, nightStepIndex, discussEndsAt, discussPaused, dawnDied, eliminated } =
    opts
  const steps = buildNightSteps(state)
  const step = steps[Math.min(nightStepIndex, steps.length - 1)]
  const living = livingPlayers(state)
  const isNight = state.phase === 'night' || state.phase === 'first_night_cupid'

  return {
    phase: state.phase,
    day: state.day,
    players: publicPlayers(state, connected),
    discussSeconds: state.discussSeconds,
    discussEndsAt,
    discussPaused,
    votesCast: state.votes.length,
    votesNeeded: living.length,
    nightStepKind: isNight ? step?.kind : undefined,
    nightRole: isNight && step?.kind === 'role' ? step.role ?? null : isNight ? null : undefined,
    nightStepIndex: isNight ? nightStepIndex : 0,
    nightStepTotal: isNight ? steps.length : 0,
    dawnDied,
    eliminated,
    winner: state.winner,
    started: true,
  }
}

export function buildPrivateView(opts: {
  state: GameState
  playerId: string
  isHost: boolean
  nightStepIndex: number
  revealed: boolean
}): PrivateGameView {
  const { state, playerId, isHost, nightStepIndex, revealed } = opts
  const me = state.players.find((p) => p.id === playerId)
  if (!me) {
    return {
      playerId,
      name: '?',
      alive: false,
      isHost,
      canAct: false,
      revealed,
    }
  }

  const steps = buildNightSteps(state)
  const step = steps[Math.min(nightStepIndex, steps.length - 1)]
  const isNight = state.phase === 'night' || state.phase === 'first_night_cupid'
  const myVote = state.votes.find((v) => v.voterId === playerId)?.targetId ?? null

  let canAct = false
  if (isNight && me.alive && step?.kind === 'role' && step.role === me.role) {
    canAct = true
  }
  if (state.phase === 'hunter_revenge') {
    const hunter = state.players.find((p) => p.role === 'hunter' && !p.alive)
    canAct = hunter?.id === playerId
  }

  // Role is always sent privately once the game exists; `revealed` is only the ack flag.
  const view: PrivateGameView = {
    playerId: me.id,
    name: me.name,
    role: me.role,
    alive: me.alive,
    isHost,
    canAct,
    myVote,
    revealed,
  }

  if (me.role === 'werewolf') {
    view.wolfTeammates = playersWithRole(state, 'werewolf')
      .filter((p) => p.id !== me.id)
      .map((p) => ({ id: p.id, name: p.name }))
  }

  if (me.loverOf) {
    view.loverName = state.players.find((p) => p.id === me.loverOf)?.name
  }

  if (me.role === 'seer' && state.seerLastVision) {
    const t = state.players.find((p) => p.id === state.seerLastVision!.targetId)
    if (t) view.seerVision = { targetName: t.name, isWolf: state.seerLastVision.isWolf }
  }

  if (me.role === 'seer' && state.nightActions.seerTarget) {
    const t = state.players.find((p) => p.id === state.nightActions.seerTarget)
    if (t) view.seerVision = { targetName: t.name, isWolf: t.role === 'werewolf' }
  }

  if (me.role === 'spy' && state.nightActions.spyPeekTarget) {
    const t = state.players.find((p) => p.id === state.nightActions.spyPeekTarget)
    if (t) view.spyPeek = { targetName: t.name, role: t.role }
  } else if (me.role === 'spy' && state.spyLastPeek) {
    const t = state.players.find((p) => p.id === state.spyLastPeek!.targetId)
    if (t) view.spyPeek = { targetName: t.name, role: state.spyLastPeek.role }
  }

  if (me.role === 'witch') {
    const victim = state.players.find((p) => p.id === state.nightActions.werewolfTarget)
    view.witch = {
      healLeft: state.witch.healLeft,
      poisonLeft: state.witch.poisonLeft,
      victimName: victim?.name,
    }
  }

  if (me.role === 'littlegirl') {
    if (state.nightActions.littleGirlPeekTarget) {
      const t = state.players.find((p) => p.id === state.nightActions.littleGirlPeekTarget)
      if (t) view.littleGirlPeek = { targetName: t.name, isWolf: t.role === 'werewolf' }
    } else if (state.littleGirlLastPeek) {
      const t = state.players.find((p) => p.id === state.littleGirlLastPeek!.targetId)
      if (t)
        view.littleGirlPeek = {
          targetName: t.name,
          isWolf: state.littleGirlLastPeek.isWolf,
        }
    }
  }

  return view
}

export function lobbySeats(
  seats: { id: string; name: string; isHost: boolean }[],
  connected: Set<string>,
): LobbySeat[] {
  return seats.map((s) => ({
    ...s,
    connected: connected.has(s.id),
  }))
}
