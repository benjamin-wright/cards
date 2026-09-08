import { describe, expect, it } from 'vitest'
import type { Card, Suit } from '../cards'
import type { Rank } from '../cards'
import { bestLayout, canKnock, deadwoodValue, extendsMeld, isGin, layOff } from './melds'

const SUIT_CODES: Record<string, Suit> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

/** Shorthand card notation, e.g. `hand('AS', '10H')`. */
function hand(...codes: string[]): Card[] {
  return codes.map(code => ({
    rank: code.slice(0, -1) as Rank,
    suit: SUIT_CODES[code.slice(-1)],
  }))
}

describe('bestLayout', () => {
  it('finds a set and a run', () => {
    const layout = bestLayout(hand('7S', '7H', '7D', '4C', '5C', '6C', 'KH'))

    expect(layout.melds).toHaveLength(2)
    expect(layout.deadwood).toEqual(hand('KH'))
    expect(layout.deadwoodValue).toBe(10)
  })

  it('leaves everything as deadwood when nothing melds', () => {
    const layout = bestLayout(hand('2S', '5H', '9D', 'KC'))

    expect(layout.melds).toHaveLength(0)
    expect(layout.deadwood).toHaveLength(4)
    expect(layout.deadwoodValue).toBe(2 + 5 + 9 + 10)
  })

  it('picks the split that leaves the least deadwood', () => {
    // The 5♣ can serve either the run or the set, but only using it in the run
    // keeps every other club out of the deadwood.
    const layout = bestLayout(hand('5C', '6C', '7C', '5S', '5H', '5D', 'KD'))

    expect(layout.melds).toHaveLength(2)
    expect(layout.deadwoodValue).toBe(10)
  })

  it('counts aces low and court cards as ten', () => {
    expect(deadwoodValue(hand('AS', 'JD', '4C'))).toBe(15)
  })
})

describe('canKnock and isGin', () => {
  it('allows a knock at ten deadwood or less', () => {
    const cards = hand('AS', '2S', '3S', '8H', '8D', '8C', 'JD', 'QD', 'KD', '4C')

    expect(deadwoodValue(cards)).toBe(4)
    expect(canKnock(cards)).toBe(true)
    expect(isGin(cards)).toBe(false)
  })

  it('spots a hand with no deadwood at all', () => {
    const cards = hand('AS', '2S', '3S', '4S', '8H', '8D', '8C', 'JD', 'QD', 'KD')

    expect(isGin(cards)).toBe(true)
  })

  it('refuses a knock above the limit', () => {
    expect(canKnock(hand('AS', '2S', '3S', '8H', '8D', '8C', 'JD', 'QC', 'KS', '4C'))).toBe(false)
  })
})

describe('extendsMeld', () => {
  it('accepts a fourth card of a set', () => {
    const meld = bestLayout(hand('9S', '9H', '9D')).melds[0]

    expect(extendsMeld(meld, hand('9C')[0])).toBe(true)
    expect(extendsMeld(meld, hand('8C')[0])).toBe(false)
  })

  it('accepts either end of a run', () => {
    const meld = bestLayout(hand('5H', '6H', '7H')).melds[0]

    expect(extendsMeld(meld, hand('4H')[0])).toBe(true)
    expect(extendsMeld(meld, hand('8H')[0])).toBe(true)
    expect(extendsMeld(meld, hand('9H')[0])).toBe(false)
    expect(extendsMeld(meld, hand('8S')[0])).toBe(false)
  })
})

describe('layOff', () => {
  it('sheds deadwood onto the knocker melds', () => {
    const melds = bestLayout(hand('5H', '6H', '7H', '9S', '9H', '9D')).melds
    const { deadwood } = layOff(hand('8H', '9C', '2C'), melds)

    expect(deadwood).toEqual(hand('2C'))
  })

  it('leaves deadwood that fits nothing', () => {
    const melds = bestLayout(hand('5H', '6H', '7H')).melds

    expect(layOff(hand('KS', 'QC'), melds).deadwood).toHaveLength(2)
  })
})
