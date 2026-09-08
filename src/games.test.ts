import { describe, expect, it } from 'vitest'
import { SUIT_SYMBOLS, games, isPlayable, playerCountLabel, supportsPlayerCount } from './games'

describe('games', () => {
  it('has unique ids', () => {
    const ids = games.map(game => game.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses known suits', () => {
    for (const game of games) {
      expect(SUIT_SYMBOLS[game.suit]).toBeTruthy()
    }
  })

  it('has sensible player counts', () => {
    for (const game of games) {
      expect(game.minPlayers).toBeGreaterThanOrEqual(2)
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers)
    }
  })

  it('offers blackjack for two to four players', () => {
    const blackjack = games.find(game => game.id === 'blackjack')!
    expect(blackjack.available).toBe(true)
    expect(playerCountLabel(blackjack)).toBe('2-4 players')
    expect(isPlayable(blackjack, 1)).toBe(false)
    expect(isPlayable(blackjack, 2)).toBe(true)
    expect(isPlayable(blackjack, 4)).toBe(true)
    expect(isPlayable(blackjack, 5)).toBe(false)
  })

  it('never marks unavailable games as playable', () => {
    for (const game of games.filter(entry => !entry.available)) {
      expect(supportsPlayerCount(game, game.minPlayers)).toBe(true)
      expect(isPlayable(game, game.minPlayers)).toBe(false)
    }
  })
})
