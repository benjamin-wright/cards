import { describe, expect, it } from 'vitest'
import { cardPoints, handPoints } from './rules'

describe('cardPoints', () => {
  it('scores eights as fifty', () => {
    expect(cardPoints({ rank: '8', suit: 'spades' })).toBe(50)
  })

  it('scores aces as one', () => {
    expect(cardPoints({ rank: 'A', suit: 'spades' })).toBe(1)
  })

  it('scores face cards as ten', () => {
    expect(cardPoints({ rank: 'J', suit: 'spades' })).toBe(10)
    expect(cardPoints({ rank: 'Q', suit: 'spades' })).toBe(10)
    expect(cardPoints({ rank: 'K', suit: 'spades' })).toBe(10)
  })

  it('scores number cards at pip value', () => {
    expect(cardPoints({ rank: '7', suit: 'spades' })).toBe(7)
  })
})

describe('handPoints', () => {
  it('sums the points of every card', () => {
    const cards = [
      { rank: '8' as const, suit: 'spades' as const },
      { rank: '2' as const, suit: 'hearts' as const },
      { rank: 'K' as const, suit: 'clubs' as const },
    ]
    expect(handPoints(cards)).toBe(50 + 2 + 10)
  })
})
