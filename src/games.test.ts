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

  it('offers blackjack for exactly two players', () => {
    const blackjack = games.find(game => game.id === 'blackjack')!
    expect(blackjack.available).toBe(true)
    expect(playerCountLabel(blackjack)).toBe('2 players')
    expect(isPlayable(blackjack, 1)).toBe(false)
    expect(isPlayable(blackjack, 2)).toBe(true)
    expect(isPlayable(blackjack, 3)).toBe(false)
  })

  it('offers cribbage for exactly two players', () => {
    const cribbage = games.find(game => game.id === 'cribbage')!
    expect(cribbage.available).toBe(true)
    expect(playerCountLabel(cribbage)).toBe('2 players')
    expect(isPlayable(cribbage, 1)).toBe(false)
    expect(isPlayable(cribbage, 2)).toBe(true)
    expect(isPlayable(cribbage, 3)).toBe(false)
  })

  it('offers roulette for exactly two players', () => {
    const roulette = games.find(game => game.id === 'roulette')!
    expect(roulette.available).toBe(true)
    expect(playerCountLabel(roulette)).toBe('2 players')
    expect(isPlayable(roulette, 1)).toBe(false)
    expect(isPlayable(roulette, 2)).toBe(true)
    expect(isPlayable(roulette, 3)).toBe(false)
  })

  it('never marks unavailable games as playable', () => {
    for (const game of games.filter(entry => !entry.available)) {
      expect(supportsPlayerCount(game, game.minPlayers)).toBe(true)
      expect(isPlayable(game, game.minPlayers)).toBe(false)
    }
  })
})
