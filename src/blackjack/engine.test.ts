import { describe, expect, it } from 'vitest'
import {
  ANTE,
  affordableRaises,
  createDeck,
  handScore,
  houseShouldTwist,
  isBust,
  payout,
  playHouse,
  settle,
  shuffle,
} from './engine'
import type { Card } from './engine'

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ rank, suit })

describe('createDeck', () => {
  it('builds 52 unique cards', () => {
    const deck = createDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(c => `${c.rank}-${c.suit}`)).size).toBe(52)
  })
})

describe('shuffle', () => {
  it('keeps every card and leaves the input untouched', () => {
    const deck = createDeck()
    let seed = 0
    const shuffled = shuffle(deck, () => {
      seed = (seed + 0.37) % 1
      return seed
    })

    expect(shuffled).toHaveLength(deck.length)
    expect([...shuffled].sort()).not.toBe(deck)
    expect(new Set(shuffled.map(c => `${c.rank}-${c.suit}`)).size).toBe(52)
    expect(deck).toEqual(createDeck())
  })
})

describe('handScore', () => {
  it('scores number and picture cards', () => {
    expect(handScore([card('7'), card('9')])).toBe(16)
    expect(handScore([card('K'), card('Q')])).toBe(20)
  })

  it('counts an ace as eleven when it helps', () => {
    expect(handScore([card('A'), card('9')])).toBe(20)
    expect(handScore([card('A'), card('K')])).toBe(21)
  })

  it('counts an ace as one when eleven would bust', () => {
    expect(handScore([card('A'), card('K'), card('9')])).toBe(20)
    expect(handScore([card('K'), card('Q'), card('A')])).toBe(21)
  })

  it('only promotes a single ace', () => {
    expect(handScore([card('A'), card('A', 'hearts')])).toBe(12)
    expect(handScore([card('A'), card('A', 'hearts'), card('9')])).toBe(21)
  })

  it('detects bust hands', () => {
    expect(isBust([card('K'), card('Q'), card('5')])).toBe(true)
    expect(isBust([card('A'), card('K')])).toBe(false)
  })
})

describe('house rules', () => {
  it('twists below fifteen and sticks at fifteen or above', () => {
    expect(houseShouldTwist([card('7'), card('7')])).toBe(true)
    expect(houseShouldTwist([card('9'), card('5')])).toBe(true)
    expect(houseShouldTwist([card('10'), card('5')])).toBe(false)
    expect(houseShouldTwist([card('10'), card('9')])).toBe(false)
  })

  it('draws until it reaches fifteen', () => {
    const { cards, deck } = playHouse([card('5'), card('5')], [card('4'), card('6'), card('2')])
    expect(cards.map(c => c.rank)).toEqual(['5', '5', '4', '6'])
    expect(deck.map(c => c.rank)).toEqual(['2'])
  })

  it('stops when the deck runs out', () => {
    const { cards } = playHouse([card('2'), card('3')], [])
    expect(cards).toHaveLength(2)
  })
})

describe('settle', () => {
  const house = [card('10', 'hearts'), card('8', 'hearts')]

  it('loses when the player is bust, even if the house is bust too', () => {
    const bust = [card('K'), card('Q'), card('5')]
    expect(settle(bust, house)).toBe('lose')
    expect(settle(bust, [card('K', 'hearts'), card('Q', 'hearts'), card('5', 'hearts')])).toBe('lose')
  })

  it('wins when the house is bust', () => {
    expect(settle([card('5'), card('6')], [card('K'), card('Q'), card('5')])).toBe('win')
  })

  it('compares scores otherwise', () => {
    expect(settle([card('10'), card('9')], house)).toBe('win')
    expect(settle([card('10'), card('7')], house)).toBe('lose')
    expect(settle([card('10'), card('8')], house)).toBe('push')
  })
})

describe('payout', () => {
  it('doubles a winning bet, loses a losing one and returns a draw', () => {
    expect(payout('win', 10)).toBe(10)
    expect(payout('lose', 10)).toBe(-10)
    expect(payout('push', 10)).toBe(0)
  })
})

describe('affordableRaises', () => {
  it('only offers raises the player can cover', () => {
    expect(affordableRaises(100, ANTE)).toEqual([1, 10])
    expect(affordableRaises(101, ANTE)).toEqual([1, 10, 100])
    expect(affordableRaises(5, ANTE)).toEqual([1])
    expect(affordableRaises(1, ANTE)).toEqual([])
  })
})
