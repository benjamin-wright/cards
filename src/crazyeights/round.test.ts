import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../cards'
import type { Player } from '../players'
import { HAND_SIZE } from './rules'
import {
  canDraw,
  canPass,
  canPlay,
  canPlayAny,
  createRound,
  draw,
  handFor,
  isRound,
  pass,
  playCard,
  topOfDiscard,
  type Round,
} from './round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 100 },
  { id: 'b', name: 'Bob', cash: 100 },
]

const SUIT_CODES: Record<string, Suit> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
}

function hand(...codes: string[]): Card[] {
  return codes.map(code => ({
    rank: code.slice(0, -1) as Rank,
    suit: SUIT_CODES[code.slice(-1)],
  }))
}

/** Deterministic rng so shuffles are repeatable in tests. */
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

/** A round with hands and piles set up by hand, for scenario-driven cases. */
function staged(overrides: Partial<Round>): Round {
  const base = createRound(players, 'a', seeded(7))
  return { ...base, ...overrides }
}

describe('createRound', () => {
  it('deals seven cards each and turns one card up', () => {
    const round = createRound(players, 'a', seeded(1))

    expect(round.hands).toHaveLength(2)
    for (const player of round.hands) {
      expect(player.cards).toHaveLength(HAND_SIZE)
    }
    expect(round.discard).toHaveLength(1)
    expect(round.stock).toHaveLength(52 - 2 * HAND_SIZE - 1)
    expect(round.turn).toBe('a')
    expect(round.activeSuit).toBe(topOfDiscard(round)!.suit)
    expect(round.pendingPickup).toBe(0)
    expect(round.drawn).toBeNull()
    expect(isRound(round)).toBe(true)
  })

  it('can start with either player', () => {
    expect(createRound(players, 'b', seeded(1)).turn).toBe('b')
  })
})

describe('canPlay', () => {
  it('allows a card matching the active suit', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9H') },
        { playerId: 'b', name: 'Bob', cards: hand('3C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'a', { rank: '9', suit: 'hearts' })).toBe(true)
  })

  it('allows a card matching the rank', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('5C') },
        { playerId: 'b', name: 'Bob', cards: hand('3C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'a', { rank: '5', suit: 'clubs' })).toBe(true)
  })

  it('rejects a card matching neither suit nor rank', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9C') },
        { playerId: 'b', name: 'Bob', cards: hand('3C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'a', { rank: '9', suit: 'clubs' })).toBe(false)
  })

  it('rejects cards when it is not that player\'s turn', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9H') },
        { playerId: 'b', name: 'Bob', cards: hand('9C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'b', { rank: '9', suit: 'clubs' })).toBe(false)
  })

  it('always allows a jack, as a wild card', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('JC') },
        { playerId: 'b', name: 'Bob', cards: hand('3C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'a', { rank: 'J', suit: 'clubs' })).toBe(true)
  })

  it('only allows a two while a pick-up is pending', () => {
    const round = staged({
      discard: hand('2H'),
      activeSuit: 'hearts',
      pendingPickup: 2,
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('2C', '9H') },
        { playerId: 'b', name: 'Bob', cards: hand('3C') },
      ],
      turn: 'a',
    })

    expect(canPlay(round, 'a', { rank: '2', suit: 'clubs' })).toBe(true)
    expect(canPlay(round, 'a', { rank: '9', suit: 'hearts' })).toBe(false)
  })
})

describe('playCard', () => {
  it('moves the card to the discard pile, sets the active suit and passes the turn', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9H', '3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = playCard(round, 'a', { rank: '9', suit: 'hearts' })

    expect(topOfDiscard(next)).toEqual({ rank: '9', suit: 'hearts' })
    expect(next.activeSuit).toBe('hearts')
    expect(handFor(next, 'a')!.cards).toEqual(hand('3C'))
    expect(next.turn).toBe('b')
    expect(next.drawn).toBeNull()
  })

  it('requires a chosen suit for a jack, and switches play to it', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('JH', '3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    expect(playCard(round, 'a', { rank: 'J', suit: 'hearts' })).toBe(round)

    const next = playCard(round, 'a', { rank: 'J', suit: 'hearts' }, 'clubs')
    expect(next.activeSuit).toBe('clubs')
    expect(next.turn).toBe('b')
  })

  it('adds to a stacking pick-up when a two is played', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      pendingPickup: 2,
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('2C', '3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = playCard(round, 'a', { rank: '2', suit: 'clubs' })
    expect(next.pendingPickup).toBe(4)
    expect(next.turn).toBe('b')
  })

  it('skips the other player when an eight is played, so the turn returns to the same player', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('8H', '3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = playCard(round, 'a', { rank: '8', suit: 'hearts' })
    expect(next.turn).toBe('a')
  })

  it('ends the round when a hand empties, scoring the loser\'s remaining cards', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9H') },
        { playerId: 'b', name: 'Bob', cards: hand('4D', 'KC') },
      ],
      turn: 'a',
    })

    const next = playCard(round, 'a', { rank: '9', suit: 'hearts' })
    expect(next.result).toEqual({
      winnerId: 'a',
      points: 4 + 10,
      hands: next.hands,
    })
  })

  it('rejects an unplayable card', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    expect(playCard(round, 'a', { rank: '9', suit: 'clubs' })).toBe(round)
  })
})

describe('drawing', () => {
  it('takes a single card and offers it for play when it matches', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      stock: hand('9H', '2C'),
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = draw(round, 'a')
    expect(handFor(next, 'a')!.cards).toEqual(hand('3C', '9H'))
    expect(next.drawn).toEqual({ rank: '9', suit: 'hearts' })
    expect(next.turn).toBe('a')
    expect(canPass(next, 'a')).toBe(true)
  })

  it('passes the turn automatically when the drawn card cannot be played', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      stock: hand('9C', '2H'),
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = draw(round, 'a')
    expect(handFor(next, 'a')!.cards).toEqual(hand('3C', '9C'))
    expect(next.drawn).toBeNull()
    expect(next.turn).toBe('b')
  })

  it('ignores a second draw in the same turn', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      stock: hand('9H', '2C', '6D'),
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const drawn = draw(round, 'a')
    expect(draw(drawn, 'a')).toBe(drawn)
  })

  it('picks up the whole pending stack at once and passes the turn', () => {
    const round = staged({
      discard: hand('2H'),
      activeSuit: 'hearts',
      pendingPickup: 4,
      stock: hand('9H', '2C', '6D'),
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = draw(round, 'a')
    expect(handFor(next, 'a')!.cards).toHaveLength(1 + 3)
    expect(next.pendingPickup).toBe(0)
    expect(next.turn).toBe('b')
    expect(next.drawn).toBeNull()
    expect(next.stock).toHaveLength(0)
  })

  it('reshuffles the discard pile back into the stock when it runs out', () => {
    const round = staged({
      discard: [...hand('6D', '7D', '8D'), { rank: '2', suit: 'hearts' }],
      activeSuit: 'hearts',
      pendingPickup: 2,
      stock: [],
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    const next = draw(round, 'a', seeded(2))
    expect(handFor(next, 'a')!.cards).toHaveLength(3)
    expect(next.discard).toEqual([{ rank: '2', suit: 'hearts' }])
    expect(next.stock).toHaveLength(1)
  })

  it('ignores the player who is not on turn', () => {
    const round = createRound(players, 'a', seeded(4))
    expect(draw(round, 'b')).toBe(round)
    expect(canDraw(round, 'b')).toBe(false)
  })
})

describe('canPlayAny', () => {
  it('is true only when some card in hand can be played', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9C', '2D') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    expect(canPlayAny(round, 'a')).toBe(false)

    const withMatch = staged({
      ...round,
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('9H', '2D') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
    })
    expect(canPlayAny(withMatch, 'a')).toBe(true)
  })
})

describe('pass', () => {
  it('ends the turn after a drawn card is kept instead of played', () => {
    const round = staged({
      discard: hand('5H'),
      activeSuit: 'hearts',
      drawn: { rank: '9', suit: 'hearts' },
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('3C', '9H') },
        { playerId: 'b', name: 'Bob', cards: hand('4D') },
      ],
      turn: 'a',
    })

    expect(canPass(round, 'a')).toBe(true)
    const next = pass(round, 'a')
    expect(next.turn).toBe('b')
    expect(next.drawn).toBeNull()
  })

  it('does nothing before a card has been drawn', () => {
    const round = createRound(players, 'a', seeded(9))
    expect(canPass(round, 'a')).toBe(false)
    expect(pass(round, 'a')).toBe(round)
  })
})
