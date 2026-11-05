import type { RoleId } from './types'

/** Smart role presets by player count. Totals must equal playerCount. */
export function presetForCount(playerCount: number): Partial<Record<RoleId, number>> {
  if (playerCount < 4 || playerCount > 20) {
    throw new Error('Player count must be between 4 and 20')
  }

  // Wolves scale roughly 1 per 4–5 players
  const wolves =
    playerCount <= 5 ? 1 :
    playerCount <= 8 ? 2 :
    playerCount <= 12 ? 3 :
    playerCount <= 16 ? 4 : 5

  const roles: Partial<Record<RoleId, number>> = { werewolf: wolves }

  // Always include Seer at 5+
  if (playerCount >= 5) roles.seer = 1
  // Doctor at 6+
  if (playerCount >= 6) roles.doctor = 1
  // Witch at 7+
  if (playerCount >= 7) roles.witch = 1
  // Hunter at 8+
  if (playerCount >= 8) roles.hunter = 1
  // Cupid at 9+
  if (playerCount >= 9) roles.cupid = 1
  // Spy at 10+
  if (playerCount >= 10) roles.spy = 1
  // Little Girl optional at 11+
  if (playerCount >= 11) roles.littlegirl = 1

  const assigned = Object.values(roles).reduce((a, b) => a + (b ?? 0), 0)
  roles.villager = Math.max(0, playerCount - assigned)

  // Tiny tables: keep it simple
  if (playerCount === 4) {
    return { werewolf: 1, villager: 2, seer: 1 }
  }

  return roles
}

export function totalRoles(counts: Partial<Record<RoleId, number>>): number {
  return Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
}

export function adjustRole(
  counts: Partial<Record<RoleId, number>>,
  role: RoleId,
  delta: number,
  playerCount: number,
): Partial<Record<RoleId, number>> {
  const next = { ...counts }
  const cur = next[role] ?? 0
  const max = role === 'werewolf' ? Math.floor(playerCount / 2) : role === 'villager' ? playerCount : 1
  const val = Math.max(0, Math.min(max, cur + delta))
  if (val === 0) delete next[role]
  else next[role] = val

  // Rebalance villagers to fill
  const nonVillager = Object.entries(next)
    .filter(([k]) => k !== 'villager')
    .reduce((a, [, v]) => a + (v ?? 0), 0)
  const vill = playerCount - nonVillager
  if (vill < 0) {
    // Too many specials — refuse last change
    return counts
  }
  if (vill === 0) delete next.villager
  else next.villager = vill
  return next
}
