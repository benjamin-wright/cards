export type Player = {
  id: string
  name: string
  cash: number
}

/** What a game hands back when a wager is settled: the cash each player ends on. */
export type Settlement = {
  playerId: string
  cashAfter: number
}

/** The app always seats exactly two players, facing each other across the device. */
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 2
export const STARTING_CASH = 100

export function createPlayer(index: number): Player {
  return {
    id: `player-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    cash: STARTING_CASH,
  }
}

/** Puts everyone back to the starting cash pile. */
export function resetCash(players: Player[]): Player[] {
  return players.map(player => ({ ...player, cash: STARTING_CASH }))
}

export function isPlayerList(value: unknown): value is Player[] {
  return (
    Array.isArray(value) &&
    value.length >= MIN_PLAYERS &&
    value.length <= MAX_PLAYERS &&
    value.every(entry => {
      const player = entry as Partial<Player>
      return (
        typeof entry === 'object' &&
        entry !== null &&
        typeof player.id === 'string' &&
        typeof player.name === 'string' &&
        typeof player.cash === 'number' &&
        Number.isFinite(player.cash)
      )
    })
  )
}

export function displayName(player: Player, index: number): string {
  const trimmed = player.name.trim()
  return trimmed === '' ? `Player ${index + 1}` : trimmed
}
