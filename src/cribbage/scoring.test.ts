import { describe, expect, it } from 'vitest'
import type { Card } from '../cards'
import { cardValue, scoreHand, scoreHeels, scorePegging } from './scoring'

describe('Cribbage scoring', () => {
  it('calculates correct card values', () => {
    expect(cardValue({ rank: 'A', suit: 'spades' })).toBe(1)
    expect(cardValue({ rank: '5', suit: 'hearts' })).toBe(5)
    expect(cardValue({ rank: '10', suit: 'diamonds' })).toBe(10)
    expect(cardValue({ rank: 'J', suit: 'clubs' })).toBe(10)
    expect(cardValue({ rank: 'Q', suit: 'spades' })).toBe(10)
    expect(cardValue({ rank: 'K', suit: 'hearts' })).toBe(10)
  })

  it('scores the famous 29-hand correctly', () => {
    const hand: Card[] = [
      { rank: '5', suit: 'spades' },
      { rank: '5', suit: 'hearts' },
      { rank: '5', suit: 'diamonds' },
      { rank: 'J', suit: 'clubs' },
    ]
    const starter: Card = { rank: '5', suit: 'clubs' }
    const result = scoreHand(hand, starter, false)
    expect(result.totalPoints).toBe(29)
  })

  it('scores fifteens, pairs, and runs in hands', () => {
    const hand: Card[] = [
      { rank: '3', suit: 'spades' },
      { rank: '4', suit: 'hearts' },
      { rank: '5', suit: 'diamonds' },
      { rank: '5', suit: 'clubs' },
    ]
    const starter: Card = { rank: 'K', suit: 'spades' }
    // 3,4,5s:
    // fifteens: 3+4+5♠=12 (no), 5+K=15 (x2) -> 4 pts
    // pairs: 5♠+5♣ (1 pair) -> 2 pts
    // runs: 3,4,5♠ and 3,4,5♣ -> double run of 3 -> 6 pts
    // total = 4 + 2 + 6 = 12
    const result = scoreHand(hand, starter, false)
    expect(result.totalPoints).toBe(12)
  })

  it('scores 4-card flush in hand vs crib', () => {
    const hand: Card[] = [
      { rank: '2', suit: 'hearts' },
      { rank: '4', suit: 'hearts' },
      { rank: '6', suit: 'hearts' },
      { rank: '8', suit: 'hearts' },
    ]
    const starterNotMatching: Card = { rank: 'K', suit: 'spades' }
    const starterMatching: Card = { rank: 'K', suit: 'hearts' }

    // Hand: 4-card flush scores 4 pts when starter doesn't match
    expect(scoreHand(hand, starterNotMatching, false).totalPoints).toBe(4)
    // Hand: 5-card flush scores 5 pts when starter matches
    expect(scoreHand(hand, starterMatching, false).totalPoints).toBe(5)

    // Crib: 4-card flush scores 0 pts in crib when starter doesn't match
    expect(scoreHand(hand, starterNotMatching, true).totalPoints).toBe(0)
    // Crib: 5-card flush scores 5 pts in crib when starter matches
    expect(scoreHand(hand, starterMatching, true).totalPoints).toBe(5)
  })

  it('scores His Nobs correctly', () => {
    const hand: Card[] = [
      { rank: 'J', suit: 'hearts' },
      { rank: '2', suit: 'spades' },
      { rank: '4', suit: 'diamonds' },
      { rank: '7', suit: 'clubs' },
    ]
    const starterHearts: Card = { rank: 'K', suit: 'hearts' }
    const starterSpades: Card = { rank: 'K', suit: 'spades' }

    expect(scoreHand(hand, starterHearts, false).totalPoints).toBe(1)
    expect(scoreHand(hand, starterSpades, false).totalPoints).toBe(0)
  })

  it('scores pegging fifteens, 31, pairs, and runs', () => {
    // Fifteen
    const p1 = scorePegging([{ rank: '7', suit: 'spades' }, { rank: '8', suit: 'hearts' }], 15)
    expect(p1.points).toBe(2)
    expect(p1.reasons).toContain('15 for 2')

    // 31
    const p2 = scorePegging(
      [
        { rank: '10', suit: 'spades' },
        { rank: '10', suit: 'hearts' },
        { rank: '10', suit: 'diamonds' },
        { rank: 'A', suit: 'clubs' },
      ],
      31,
    )
    expect(p2.points).toBe(2)
    expect(p2.reasons).toContain('31 for 2')

    // Pair
    const p3 = scorePegging([{ rank: '6', suit: 'spades' }, { rank: '6', suit: 'hearts' }], 12)
    expect(p3.points).toBe(2)
    expect(p3.reasons).toContain('Pair for 2')

    // Three of a kind
    const p4 = scorePegging(
      [{ rank: '6', suit: 'spades' }, { rank: '6', suit: 'hearts' }, { rank: '6', suit: 'diamonds' }],
      18,
    )
    expect(p4.points).toBe(6)
    expect(p4.reasons).toContain('Three of a kind for 6')

    // Four of a kind
    const p5 = scorePegging(
      [
        { rank: '6', suit: 'spades' },
        { rank: '6', suit: 'hearts' },
        { rank: '6', suit: 'diamonds' },
        { rank: '6', suit: 'clubs' },
      ],
      24,
    )
    expect(p5.points).toBe(12)
    expect(p5.reasons).toContain('Four of a kind for 12')

    // Out of order run of 3 (4, 6, 5)
    const p6 = scorePegging(
      [{ rank: '4', suit: 'spades' }, { rank: '6', suit: 'hearts' }, { rank: '5', suit: 'diamonds' }],
      15,
    )
    // 15 for 2 AND run of 3 for 3 = 5 points
    expect(p6.points).toBe(5)
    expect(p6.reasons).toContain('15 for 2')
    expect(p6.reasons).toContain('Run of 3 for 3')
  })

  it('scores His Heels', () => {
    expect(scoreHeels({ rank: 'J', suit: 'spades' })).toBe(2)
    expect(scoreHeels({ rank: 'Q', suit: 'spades' })).toBe(0)
  })
})
