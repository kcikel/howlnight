import type { GameConfig, Player, RoleId } from './types'
import { ROLES } from './types'
import { totalRoles } from './presets'

/** Fisher–Yates shuffle (pure, seeded optional). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function expandRoles(counts: Partial<Record<RoleId, number>>): RoleId[] {
  const list: RoleId[] = []
  for (const [role, n] of Object.entries(counts) as [RoleId, number][]) {
    if (!ROLES[role]) throw new Error(`Unknown role: ${role}`)
    for (let i = 0; i < (n ?? 0); i++) list.push(role)
  }
  return list
}

export function assignRoles(config: GameConfig, rng: () => number = Math.random): Player[] {
  const { players, roleCounts } = config
  if (players.length < 4 || players.length > 20) {
    throw new Error('Need 4–20 players')
  }
  if (totalRoles(roleCounts) !== players.length) {
    throw new Error(`Role count ${totalRoles(roleCounts)} != players ${players.length}`)
  }
  const roles = shuffle(expandRoles(roleCounts), rng)
  return players.map((p, i) => ({
    id: p.id,
    name: p.name.trim() || `Player ${i + 1}`,
    role: roles[i],
    alive: true,
  }))
}
