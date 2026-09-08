export type Player = {
  id: string
  name: string
  cash: number
}

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4
export const STARTING_CASH = 100

export function createPlayer(index: number): Player {
  return {
    id: `player-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    cash: STARTING_CASH,
  }
}

export function displayName(player: Player, index: number): string {
  const trimmed = player.name.trim()
  return trimmed === '' ? `Player ${index + 1}` : trimmed
}
