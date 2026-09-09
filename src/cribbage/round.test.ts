import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import {
  advanceShow,
  canPlayAnyCard,
  createRound,
  discardToCrib,
  isRound,
  playCard,
} from './round'
import { cardValue } from './scoring'

const mockPlayers: Player[] = [
  { id: 'p1', name: 'Alice', cash: 100 },
  { id: 'p2', name: 'Bob', cash: 100 },
]

describe('Cribbage round state and logic', () => {
  it('creates a fresh round with correct initial state', () => {
    const round = createRound(mockPlayers)
    expect(round.dealerId).toBe('p1')
    expect(round.nonDealerId).toBe('p2')
    expect(round.phase).toBe('discard')
    expect(round.turn).toBe('p2')
    expect(round.hands[0].dealt.length).toBe(6)
    expect(round.hands[1].dealt.length).toBe(6)
    expect(round.crib.length).toBe(0)
    expect(round.starter).toBeNull()
    expect(isRound(round)).toBe(true)
  })

  it('handles discards from both players and cuts the starter', () => {
    let round = createRound(mockPlayers)

    const p1Discards = [round.hands[0].dealt[0], round.hands[0].dealt[1]]
    round = discardToCrib(round, 'p1', p1Discards)
    expect(round.phase).toBe('discard')
    expect(round.crib.length).toBe(0)

    const p2Discards = [round.hands[1].dealt[0], round.hands[1].dealt[1]]
    round = discardToCrib(round, 'p2', p2Discards)

    expect(round.phase).toBe('play')
    expect(round.crib.length).toBe(4)
    expect(round.starter).not.toBeNull()
    expect(round.hands[0].hand.length).toBe(4)
    expect(round.hands[1].hand.length).toBe(4)
    expect(round.turn).toBe('p2')
  })

  it('handles playing cards, pegging scores, Go, and 31', () => {
    let round = createRound(mockPlayers)

    round = discardToCrib(round, 'p1', [round.hands[0].dealt[0], round.hands[0].dealt[1]])
    round = discardToCrib(round, 'p2', [round.hands[1].dealt[0], round.hands[1].dealt[1]])

    const p2Card = round.hands[1].hand[0]
    expect(canPlayAnyCard(round, 'p2')).toBe(true)

    round = playCard(round, 'p2', p2Card)
    expect(round.currentCount).toBeGreaterThan(0)
    expect(round.hands[1].played.length).toBe(1)
    expect(round.lastPlayedCard).toEqual(p2Card)
    expect(round.lastPlayedBy).toBe('p2')
  })

  it('advances through the show phase step by step', () => {
    let round = createRound(mockPlayers)
    round = discardToCrib(round, 'p1', [round.hands[0].dealt[0], round.hands[0].dealt[1]])
    round = discardToCrib(round, 'p2', [round.hands[1].dealt[0], round.hands[1].dealt[1]])

    // Play all cards
    let maxSteps = 100
    while (round.phase === 'play' && maxSteps-- > 0) {
      const turn = round.turn
      const hand = round.hands.find(h => h.playerId === turn)!
      const playable = hand.hand.find(
        c => !hand.played.includes(c) && cardValue(c) <= 31 - round.currentCount,
      )
      if (playable) {
        const nextRound = playCard(round, turn, playable)
        if (nextRound === round) break
        round = nextRound
      } else {
        break
      }
    }

    if (round.phase === 'show') {
      expect(round.showStep).toBe('nonDealer')

      round = advanceShow(round) // Non-dealer scored
      expect(round.showStep).toBe('dealer')

      round = advanceShow(round) // Dealer scored
      expect(round.showStep).toBe('crib')

      round = advanceShow(round) // Crib scored -> summary
      expect(round.phase).toBe('summary')
      expect(round.showStep).toBe('complete')
    }
  })
})
