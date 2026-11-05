import type { NightActions, Phase, RoleId } from '../engine'

/** Wire protocol between host and players. Host is authoritative. */

export type NightActionPayload =
  | { kind: 'cupid'; pair: [string, string] }
  | { kind: 'werewolf'; targetId?: string }
  | { kind: 'seer'; targetId?: string }
  | { kind: 'doctor'; targetId?: string }
  | { kind: 'spy'; targetId?: string }
  | { kind: 'witch'; heal?: boolean; poisonTargetId?: string }
  | { kind: 'littlegirl'; targetId?: string }
  | { kind: 'skip' }

export interface LobbySeat {
  id: string
  name: string
  connected: boolean
  isHost: boolean
}

export interface PublicPlayer {
  id: string
  name: string
  alive: boolean
  connected: boolean
}

export type NightStepKind = 'intro' | 'role' | 'done'

export interface PublicGameView {
  phase: Phase | 'lobby'
  day: number
  players: PublicPlayer[]
  discussSeconds: number
  discussEndsAt?: number
  discussPaused: boolean
  votesCast: number
  votesNeeded: number
  nightStepKind?: NightStepKind
  nightRole?: RoleId | null
  nightStepIndex: number
  nightStepTotal: number
  dawnDied?: { id: string; name: string; role: RoleId }[]
  eliminated?: { id: string; name: string; role: RoleId }[]
  winner?: 'wolves' | 'village' | 'lovers'
  started: boolean
  roleCounts?: Partial<Record<RoleId, number>>
}

export interface PrivateGameView {
  playerId: string
  name: string
  role?: RoleId
  alive: boolean
  isHost: boolean
  wolfTeammates?: { id: string; name: string }[]
  loverName?: string
  seerVision?: { targetName: string; isWolf: boolean }
  spyPeek?: { targetName: string; role: RoleId }
  littleGirlPeek?: { targetName: string; isWolf: boolean }
  witch?: { healLeft: boolean; poisonLeft: boolean; victimName?: string }
  /** True when this player should see the night action UI for the current step. */
  canAct: boolean
  myVote?: string | 'skip' | null
  revealed: boolean
}

export type ClientToHost =
  | { v: 1; type: 'join'; name: string; token: string }
  | { v: 1; type: 'rejoin'; token: string }
  | { v: 1; type: 'night_action'; action: NightActionPayload }
  | { v: 1; type: 'vote'; targetId: string | 'skip' }
  | { v: 1; type: 'hunter_shot'; targetId: string }
  | { v: 1; type: 'ack_reveal' }
  | { v: 1; type: 'sync' }
  | { v: 1; type: 'ping' }

export type HostToClient =
  | { v: 1; type: 'welcome'; playerId: string; token: string; salt: string; isHost: boolean }
  | { v: 1; type: 'lobby'; seats: LobbySeat[]; canStart: boolean; code: string }
  | { v: 1; type: 'public'; view: PublicGameView }
  | { v: 1; type: 'private'; view: PrivateGameView }
  | { v: 1; type: 'error'; code: string; message: string }
  | { v: 1; type: 'kicked' }
  | { v: 1; type: 'pong' }

export type WireMessage = ClientToHost | HostToClient

export function nightActionToPatch(action: NightActionPayload): Partial<NightActions> {
  switch (action.kind) {
    case 'cupid':
      return { cupidPair: action.pair }
    case 'werewolf':
      return { werewolfTarget: action.targetId }
    case 'seer':
      return { seerTarget: action.targetId }
    case 'doctor':
      return { doctorTarget: action.targetId }
    case 'spy':
      return { spyPeekTarget: action.targetId }
    case 'witch':
      return {
        witchHeal: action.heal,
        witchPoisonTarget: action.poisonTargetId,
      }
    case 'littlegirl':
      return { littleGirlPeekTarget: action.targetId }
    case 'skip':
      return {}
  }
}
