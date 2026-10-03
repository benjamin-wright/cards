import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import { createRound, isRound, stick, twist } from './round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 0 },
  { id: 'b', name: 'Bob', cash: 0 },
]

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

describe('createRound', () => {
  it('deals two private cards per player, no house hand, regardless of cash', () => {
    const round = createRound(players, 'a', seeded(1))
    expect(round.seats.map(seat => seat.cards.length)).toEqual([2, 2])
    expect(round.deck).toHaveLength(48)
    const all = [...round.deck, ...round.seats.flatMap(seat => seat.cards)]
    expect(new Set(all.map(card => `${card.rank}-${card.suit}`)).size).toBe(52)
  })

  it('starts only the selected player and retains seat order', () => {
    const round = createRound(players, 'b', seeded(2))
    expect(round.turn).toBe('b')
    expect(round.seats.map(seat => seat.playerId)).toEqual(['a', 'b'])
    expect(round.seats.map(seat => seat.status)).toEqual(['waiting', 'playing'])
  })
})

describe('turns', () => {
  it('rejects actions out of turn and changes turns after sticking', () => {
    const round = createRound(players, 'a', seeded(3))
    expect(twist(round, 'b')).toBe(round)
    expect(stick(round, 'b')).toBe(round)
    const next = stick(round, 'a')
    expect(next.turn).toBe('b')
    expect(next.seats.map(seat => seat.status)).toEqual(['stood', 'playing'])
    expect(twist(next, 'a')).toBe(next)
  })

  it('keeps the turn after a non-bust twist', () => {
    const round = createRound(players, 'a', seeded(4))
    const next = twist(round, 'a')
    expect(next.seats[0].cards).toHaveLength(3)
    expect(next.deck).toHaveLength(47)
    if (next.seats[0].status === 'playing') expect(next.turn).toBe('a')
  })

  it('moves on automatically after bust and completes after the second player', () => {
    let round = createRound(players, 'a', seeded(5))
    while (round.turn === 'a') round = twist(round, 'a')
    expect(round.seats[0].status).toBe('bust')
    expect(round.turn).toBe('b')
    round = stick(round, 'b')
    expect(round.turn).toBeNull()
    expect(round.result?.winnerId).toBe('b')
    expect(round.result?.scores).toHaveLength(2)
    expect(stick(round, 'b')).toBe(round)
  })

  it('draws when both players bust', () => {
    let round = createRound(players, 'b', seeded(6))
    while (round.turn !== null) round = twist(round, round.turn)
    expect(round.result?.winnerId).toBeNull()
  })

  it('does not allow a twist when the deck is empty', () => {
    const round = { ...createRound(players), deck: [] }
    expect(twist(round, 'a')).toBe(round)
  })
})

describe('isRound', () => {
  it('accepts active and complete rounds through storage', () => {
    const round = createRound(players, 'b', seeded(7))
    expect(isRound(JSON.parse(JSON.stringify(round)))).toBe(true)
    expect(isRound(JSON.parse(JSON.stringify(stick(stick(round, 'b'), 'a'))))).toBe(true)
  })

  it('rejects old house/betting state and malformed turns', () => {
    const round = createRound(players, 'a', seeded(8))
    expect(isRound(undefined)).toBe(false)
    expect(isRound({ ...round, seats: [] })).toBe(false)
    expect(isRound({ ...round, turn: 'b' })).toBe(false)
    expect(isRound({ ...round, deck: [{ rank: 'Z', suit: 'spades' }] })).toBe(false)
    expect(isRound({ ...round, seats: round.seats.map(seat => ({ ...seat, status: 'playing' })) })).toBe(false)
    expect(isRound({ ...round, house: [], seats: [{ ...round.seats[0], status: 'playing' }] })).toBe(false)
    const complete = stick(stick(round, 'a'), 'b')
    expect(isRound({ ...complete, result: { winnerId: null, scores: [null, null] } })).toBe(false)
  })
})
