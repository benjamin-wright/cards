import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../cards'
import type { Player } from '../players'
import { HAND_SIZE } from './melds'
import {
  canKnockNow,
  canKnockWith,
  createRound,
  discard,
  drawFromDiscard,
  drawFromStock,
  isRound,
  knock,
  knockNow,
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

/** A round with hands and piles set up by hand, for scoring cases. */
function staged(overrides: Partial<Round>): Round {
  const base = createRound(players, 'a', seeded(7))
  return { ...base, ...overrides }
}

describe('createRound', () => {
  it('deals ten cards each and turns one card up', () => {
    const round = createRound(players, 'a', seeded(1))

    expect(round.hands).toHaveLength(2)
    for (const player of round.hands) {
      expect(player.cards).toHaveLength(HAND_SIZE)
    }
    expect(round.discard).toHaveLength(1)
    expect(round.stock).toHaveLength(52 - 2 * HAND_SIZE - 1)
    expect(round.turn).toBe('a')
    expect(round.phase).toBe('draw')
    expect(isRound(round)).toBe(true)
  })

  it('can start with either player', () => {
    expect(createRound(players, 'b', seeded(1)).turn).toBe('b')
  })
})

describe('drawing', () => {
  it('takes the top of the stock and moves to the discard step', () => {
    const round = createRound(players, 'a', seeded(2))
    const next = drawFromStock(round, 'a')

    expect(next.hands[0].cards).toHaveLength(HAND_SIZE + 1)
    expect(next.stock).toHaveLength(round.stock.length - 1)
    expect(next.phase).toBe('discard')
    expect(next.drawn).toEqual(round.stock[0])
  })

  it('takes the face-up card and blocks throwing it straight back', () => {
    const round = createRound(players, 'a', seeded(3))
    const upcard = topOfDiscard(round)!
    const next = drawFromDiscard(round, 'a')

    expect(next.discard).toHaveLength(0)
    expect(next.blockedDiscard).toEqual(upcard)
    expect(discard(next, 'a', upcard)).toBe(next)
  })

  it('ignores the player who isn\'t on turn', () => {
    const round = createRound(players, 'a', seeded(4))

    expect(drawFromStock(round, 'b')).toBe(round)
    expect(drawFromDiscard(round, 'b')).toBe(round)
  })

  it('ignores a second draw in the same turn', () => {
    const drawn = drawFromStock(createRound(players, 'a', seeded(5)), 'a')

    expect(drawFromStock(drawn, 'a')).toBe(drawn)
  })
})

describe('discarding', () => {
  it('passes the turn on', () => {
    const drawn = drawFromStock(createRound(players, 'a', seeded(6)), 'a')
    const card = drawn.hands[0].cards[0]
    const next = discard(drawn, 'a', card)

    expect(next.hands[0].cards).toHaveLength(HAND_SIZE)
    expect(topOfDiscard(next)).toEqual(card)
    expect(next.turn).toBe('b')
    expect(next.phase).toBe('draw')
    expect(next.drawn).toBeNull()
  })

  it('ends the hand as a draw when the stock runs out', () => {
    const round = staged({
      stock: hand('2C', '3C'),
      phase: 'discard',
      turn: 'a',
    })
    const next = discard(round, 'a', round.hands[0].cards[0])

    expect(next.phase).toBe('summary')
    expect(next.result?.kind).toBe('draw')
    expect(next.result?.winnerId).toBeNull()
  })
})

describe('knocking', () => {
  const knocker = hand('AS', '2S', '3S', '8H', '8D', '8C', 'JD', 'QD', 'KD', '4C', 'KS')

  it('is only offered when the discard leaves ten deadwood or less', () => {
    const round = staged({
      phase: 'discard',
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: knocker },
        { playerId: 'b', name: 'Bob', cards: hand('5H', '6H', '7H', '9S', '9H', '9D', '2C', '3D', 'KC', 'QH') },
      ],
    })

    expect(canKnockWith(round, 'a', hand('KS')[0])).toBe(true)
    // Throwing an eight breaks the set, leaving 4♣ and K♠ as deadwood.
    expect(canKnockWith(round, 'a', hand('8H')[0])).toBe(false)
  })

  it('scores the difference in deadwood', () => {
    const round = staged({
      phase: 'discard',
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: knocker },
        { playerId: 'b', name: 'Bob', cards: hand('5H', '6H', '7H', '9S', '9H', '9D', '2C', '3D', 'KC', 'QH') },
      ],
    })
    const next = knock(round, 'a', hand('KS')[0])

    expect(next.phase).toBe('summary')
    expect(next.result?.kind).toBe('knock')
    expect(next.result?.winnerId).toBe('a')
    // Ada keeps 4♣ (4), Bob is left with 2♣, 3♦, K♣ and Q♥ (25).
    expect(next.result?.points).toBe(25 - 4)
  })

  it('lays the defender deadwood off onto the knocker melds', () => {
    const round = staged({
      phase: 'discard',
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: knocker },
        // 4♠ extends Ada's spade run and 8♠ completes her set of eights.
        { playerId: 'b', name: 'Bob', cards: hand('5H', '6H', '7H', '9S', '9H', '9D', '4S', '8S', '2C', '3D') },
      ],
    })
    const next = knock(round, 'a', hand('KS')[0])
    const defender = next.result?.hands.find(entry => entry.playerId === 'b')

    expect(defender?.deadwood).toEqual(hand('2C', '3D'))
    expect(next.result?.points).toBe(5 - 4)
  })

  it('awards the gin bonus and skips layoffs', () => {
    const round = staged({
      phase: 'discard',
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('AS', '2S', '3S', '4S', '8H', '8D', '8C', 'JD', 'QD', 'KD', 'KS') },
        { playerId: 'b', name: 'Bob', cards: hand('5H', '6H', '7H', '9S', '9H', '9D', '5S', '8S', '2C', '3D') },
      ],
    })
    const next = knock(round, 'a', hand('KS')[0])

    expect(next.result?.kind).toBe('gin')
    // 5♠, 8♠, 2♣ and 3♦ stay as deadwood (18) plus the 25 point bonus.
    expect(next.result?.points).toBe(18 + 25)
  })

  it('gives the hand to the defender on an undercut', () => {
    const round = staged({
      phase: 'discard',
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: hand('AS', '2S', '3S', '8H', '8D', '8C', 'JD', 'QD', 'KD', '9C', 'KS') },
        { playerId: 'b', name: 'Bob', cards: hand('5H', '6H', '7H', '9S', '9H', '9D', '4H', '3H', '2H', '2C') },
      ],
    })
    const next = knock(round, 'a', hand('KS')[0])

    expect(next.result?.kind).toBe('undercut')
    expect(next.result?.winnerId).toBe('b')
    expect(next.result?.knockerId).toBe('a')
    // Ada is left with 9♣ (9), Bob with 2♣ (2), plus the 25 point bonus.
    expect(next.result?.points).toBe(9 - 2 + 25)
  })
})

describe('knocking after the discard', () => {
  const knocked = hand('AS', '2S', '3S', '8H', '8D', '8C', 'JD', 'QD', 'KD', '4C')
  const defender = hand('5H', '6H', '7H', '9S', '9H', '9D', '2C', '3D', 'KC', 'QH')

  function afterDiscard(overrides: Partial<Round> = {}): Round {
    return staged({
      phase: 'draw',
      turn: 'b',
      hands: [
        { playerId: 'a', name: 'Ada', cards: knocked },
        { playerId: 'b', name: 'Bob', cards: defender },
      ],
      ...overrides,
    })
  }

  it('stays available to the player who has just discarded', () => {
    const round = afterDiscard()

    expect(canKnockNow(round, 'a')).toBe(true)
    expect(knockNow(round, 'a').result?.points).toBe(25 - 4)
  })

  it('closes once the next card has been drawn', () => {
    const round = drawFromStock(afterDiscard(), 'b')

    expect(canKnockNow(round, 'a')).toBe(false)
    expect(knockNow(round, 'a')).toBe(round)
  })

  it('is refused above the knock limit', () => {
    expect(canKnockNow(afterDiscard(), 'b')).toBe(false)
  })

  it('is refused once the hand is over', () => {
    const round = knockNow(afterDiscard(), 'a')

    expect(canKnockNow(round, 'a')).toBe(false)
  })

  it('lets the defender undercut on their own turn', () => {
    const round = afterDiscard({
      turn: 'a',
      hands: [
        { playerId: 'a', name: 'Ada', cards: defender },
        { playerId: 'b', name: 'Bob', cards: knocked },
      ],
    })
    const next = knockNow(round, 'b')

    expect(next.result?.kind).toBe('knock')
    expect(next.result?.knockerId).toBe('b')
  })
})

describe('isRound', () => {
  it('rejects junk from storage', () => {
    expect(isRound(null)).toBe(false)
    expect(isRound({})).toBe(false)
    expect(isRound({ ...createRound(players, 'a', seeded(8)), turn: 'nobody' })).toBe(false)
    expect(isRound({ ...createRound(players, 'a', seeded(8)), stock: ['nope'] })).toBe(false)
  })
})
