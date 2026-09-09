import { describe, expect, it } from 'vitest'
import { createRound, playCard, discardToCrib } from './round'
import type { Player } from '../players'

const mockPlayers: Player[] = [
  { id: 'p1', name: 'Alice', cash: 100 },
  { id: 'p2', name: 'Bob', cash: 100 },
]

describe('Cribbage board state & last card played', () => {
  it('tracks lastPlayedCard and lastPlayedBy when cards are played', () => {
    let round = createRound(mockPlayers)
    expect(round.lastPlayedCard).toBeNull()
    expect(round.lastPlayedBy).toBeNull()

    round = discardToCrib(round, 'p1', [round.hands[0].dealt[0], round.hands[0].dealt[1]])
    round = discardToCrib(round, 'p2', [round.hands[1].dealt[0], round.hands[1].dealt[1]])

    const p2Card = round.hands[1].hand[0]
    round = playCard(round, 'p2', p2Card)

    expect(round.lastPlayedCard).toEqual(p2Card)
    expect(round.lastPlayedBy).toBe('p2')
  })

  it('maintains previousScores when scoring pegging points', () => {
    let round = createRound(mockPlayers)
    round = discardToCrib(round, 'p1', [round.hands[0].dealt[0], round.hands[0].dealt[1]])
    round = discardToCrib(round, 'p2', [round.hands[1].dealt[0], round.hands[1].dealt[1]])

    expect(round.previousScores['p1']).toBe(0)
    expect(round.previousScores['p2']).toBe(0)
  })
})
