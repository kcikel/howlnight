/** Core game types for Howlnight — original implementation of public-domain Werewolf/Mafia mechanics. */

export type RoleId =
  | 'werewolf'
  | 'villager'
  | 'seer'
  | 'doctor'
  | 'witch'
  | 'hunter'
  | 'cupid'
  | 'spy'
  | 'littlegirl'

export type Team = 'wolves' | 'village' | 'lovers'

export interface RoleDef {
  id: RoleId
  team: Team
  premium: boolean
  maxCount: number
  nightOrder: number | null // null = no night wake; lower wakes first
}

export interface Player {
  id: string
  name: string
  role: RoleId
  alive: boolean
  loverOf?: string // player id
  protectedTonight?: boolean
  poisoned?: boolean
}

export interface WitchState {
  healLeft: boolean
  poisonLeft: boolean
}

export interface NightActions {
  werewolfTarget?: string
  seerTarget?: string
  doctorTarget?: string
  witchHeal?: boolean
  witchPoisonTarget?: string
  spyPeekTarget?: string
  hunterRevengeTarget?: string
  cupidPair?: [string, string]
  littleGirlPeekTarget?: string
}

export interface DayVote {
  voterId: string
  targetId: string | 'skip'
}

export type Phase =
  | 'setup'
  | 'role_reveal'
  | 'first_night_cupid'
  | 'night'
  | 'dawn'
  | 'day_discuss'
  | 'day_vote'
  | 'elimination'
  | 'hunter_revenge'
  | 'game_over'

export interface LogEntry {
  day: number
  kind: 'night' | 'dawn' | 'vote' | 'special' | 'win'
  text: string
}

export interface GameConfig {
  players: { id: string; name: string }[]
  roleCounts: Partial<Record<RoleId, number>>
  discussSeconds?: number
}

export interface GameState {
  players: Player[]
  phase: Phase
  day: number
  witch: WitchState
  nightActions: NightActions
  pendingDeaths: string[]
  lastNightVictim?: string
  lastVoteVictim?: string
  seerLastVision?: { targetId: string; isWolf: boolean }
  spyLastPeek?: { targetId: string; role: RoleId }
  littleGirlLastPeek?: { targetId: string; isWolf: boolean; caught: boolean }
  votes: DayVote[]
  log: LogEntry[]
  winner?: 'wolves' | 'village' | 'lovers'
  cupidDone: boolean
  discussSeconds: number
}

export const ROLES: Record<RoleId, RoleDef> = {
  werewolf: { id: 'werewolf', team: 'wolves', premium: false, maxCount: 6, nightOrder: 30 },
  villager: { id: 'villager', team: 'village', premium: false, maxCount: 16, nightOrder: null },
  seer: { id: 'seer', team: 'village', premium: false, maxCount: 1, nightOrder: 20 },
  doctor: { id: 'doctor', team: 'village', premium: false, maxCount: 1, nightOrder: 40 },
  witch: { id: 'witch', team: 'village', premium: true, maxCount: 1, nightOrder: 50 },
  hunter: { id: 'hunter', team: 'village', premium: true, maxCount: 1, nightOrder: null },
  cupid: { id: 'cupid', team: 'village', premium: true, maxCount: 1, nightOrder: 10 },
  spy: { id: 'spy', team: 'village', premium: true, maxCount: 1, nightOrder: 25 },
  littlegirl: { id: 'littlegirl', team: 'village', premium: true, maxCount: 1, nightOrder: 32 },
}

export const PREMIUM_ROLES: RoleId[] = ['witch', 'hunter', 'cupid', 'spy', 'littlegirl']
