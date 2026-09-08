import { describe, expect, it } from 'vitest'
import { SUIT_SYMBOLS, games } from './games'

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
})
