import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import { createRound, isRound, revealHands, stick, twist } from './round'

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
    const round = createRound(players, seeded(1))
    expect(round.seats.map(seat => seat.cards.length)).toEqual([2, 2])
    expect(round.deck).toHaveLength(48)
    const all = [...round.deck, ...round.seats.flatMap(seat => seat.cards)]
    expect(new Set(all.map(card => `${card.rank}-${card.suit}`)).size).toBe(52)
  })

  it('starts both players able to play and retains seat order', () => {
    const round = createRound(players, seeded(2))
    expect(round.seats.map(seat => seat.playerId)).toEqual(['a', 'b'])
    expect(round.seats.map(seat => seat.status)).toEqual(['playing', 'playing'])
  })
})

describe('independent hands', () => {
  it('lets either player act first and keeps the other seat unchanged', () => {
    const round = createRound(players, seeded(3))
    const next = stick(round, 'b')
    expect(next.seats.map(seat => seat.status)).toEqual(['playing', 'stood'])
    expect(next.seats[0]).toBe(round.seats[0])
    expect(twist(next, 'b')).toBe(next)
    expect(stick(next, 'a').seats.map(seat => seat.status)).toEqual(['stood', 'stood'])
  })

  it('deals from one deck in whichever order the players twist', () => {
    const round = createRound(players, seeded(4))
    const next = twist(round, 'b')
    expect(next.seats[1].cards).toHaveLength(3)
    expect(next.seats[0].cards).toHaveLength(2)
    expect(next.seats[1].cards[2]).toEqual(round.deck[0])
    expect(next.deck).toHaveLength(47)
  })

  it('ends one hand automatically after bust without stopping the other', () => {
    let round = createRound(players, seeded(5))
    while (round.seats[0].status === 'playing') round = twist(round, 'a')
    expect(round.seats[0].status).toBe('bust')
    expect(round.seats[1].status).toBe('playing')
    expect(twist(round, 'a')).toBe(round)
    expect(revealHands(round)).toBe(round)
    round = stick(round, 'b')
    expect(round.result).toBeNull()
    expect(stick(round, 'b')).toBe(round)
    round = revealHands(round)
    expect(round.result?.winnerId).toBe('b')
    expect(round.result?.scores).toHaveLength(2)
    expect(revealHands(round)).toBe(round)
  })

  it('draws when both players bust', () => {
    let round = createRound(players, seeded(6))
    for (const playerId of ['b', 'a']) {
      while (round.seats.find(seat => seat.playerId === playerId)?.status === 'playing') {
        round = twist(round, playerId)
      }
    }
    expect(revealHands(round).result?.winnerId).toBeNull()
  })

  it('does not allow a twist when the deck is empty', () => {
    const round = { ...createRound(players), deck: [] }
    expect(twist(round, 'a')).toBe(round)
  })
})

describe('revealHands', () => {
  it('withholds the result until both players have completed their turns', () => {
    const round = createRound(players, seeded(9))
    expect(revealHands(round)).toBe(round)
    const secondHand = stick(round, 'b')
    expect(revealHands(secondHand)).toBe(secondHand)
    const ready = stick(secondHand, 'a')
    expect(ready.result).toBeNull()
    expect(revealHands(ready).result?.scores.map(entry => entry.playerId)).toEqual(['a', 'b'])
    const revealed = revealHands(ready)
    expect(twist(revealed, 'a')).toBe(revealed)
    expect(stick(revealed, 'b')).toBe(revealed)
  })
})

describe('isRound', () => {
  it('accepts active, awaiting reveal and revealed rounds through storage', () => {
    const round = createRound(players, seeded(7))
    expect(isRound(JSON.parse(JSON.stringify(round)))).toBe(true)
    const ready = stick(stick(round, 'b'), 'a')
    expect(isRound(JSON.parse(JSON.stringify(ready)))).toBe(true)
    expect(isRound(JSON.parse(JSON.stringify(revealHands(ready))))).toBe(true)
  })

  it('restores hands saved under the former turn order', () => {
    const round = createRound(players, seeded(8))
    const saved = { ...round, turn: 'a', seats: [{ ...round.seats[0] }, { ...round.seats[1], status: 'waiting' as const }] }
    expect(isRound(saved)).toBe(true)
    expect(stick(saved, 'b').seats[1].status).toBe('stood')
    expect(twist(saved, 'b').seats[1].cards).toHaveLength(3)
  })

  it('rejects malformed seats, deck and results', () => {
    const round = createRound(players, seeded(8))
    expect(isRound(undefined)).toBe(false)
    expect(isRound({ ...round, seats: [] })).toBe(false)
    expect(stick(round, 'unknown')).toBe(round)
    expect(twist(round, 'unknown')).toBe(round)
    expect(isRound({ ...round, deck: [{ rank: 'Z', suit: 'spades' }] })).toBe(false)
    expect(isRound({ ...round, seats: round.seats.map(seat => ({ ...seat, status: 'nonsense' })) })).toBe(false)
    expect(isRound({ ...round, house: [], seats: [{ ...round.seats[0], status: 'playing' }] })).toBe(false)
    const complete = revealHands(stick(stick(round, 'a'), 'b'))
    expect(isRound({ ...complete, result: { winnerId: null, scores: [null, null] } })).toBe(false)
  })
})
