import type { GameState, Player } from './types'

function alive(players: Player[]): Player[] {
  return players.filter((p) => p.alive)
}

function isWolf(p: Player): boolean {
  return p.role === 'werewolf'
}

/** Lovers win only if both lovers are the sole survivors (or both alive and everyone else dead). */
export function checkWin(state: GameState): GameState['winner'] | undefined {
  const living = alive(state.players)
  if (living.length === 0) return 'village' // edge: everyone dead → village pyrrhic? treat as village

  const lovers = living.filter((p) => p.loverOf)
  // Classic lovers ending: exactly two alive and they are linked to each other
  if (
    living.length === 2 &&
    lovers.length === 2 &&
    living[0].loverOf === living[1].id &&
    living[1].loverOf === living[0].id
  ) {
    return 'lovers'
  }

  const wolves = living.filter(isWolf)
  const villagers = living.filter((p) => !isWolf(p))

  if (wolves.length === 0) return 'village'
  // Wolves win when they equal or outnumber the village side
  if (wolves.length >= villagers.length) return 'wolves'
  return undefined
}
