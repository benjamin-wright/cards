import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import { ANTE } from './engine'
import { canAnte, createRound, finishRound, isRound, raiseBet, stick, twist } from './round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 100 },
  { id: 'b', name: 'Bob', cash: 100 },
]

/** Deterministic rng so shuffles are repeatable in tests. */
function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 1103515245 + 12345) % 2147483648
    return value / 2147483648
  }
}

describe('createRound', () => {
  it('deals two cards to each player and the house', () => {
    const round = createRound(players, seeded(1))

    expect(round.seats).toHaveLength(2)
    for (const seat of round.seats) {
      expect(seat.cards).toHaveLength(2)
      expect(seat.bet).toBe(ANTE)
      expect(seat.betLocked).toBe(false)
    }
    expect(round.house).toHaveLength(2)
    expect(round.deck).toHaveLength(52 - 6)
  })

  it('starts with both seats able to play at once', () => {
    const round = createRound(players, seeded(2))
    expect(round.phase).toBe('player')
    expect(round.seats[0].status).toBe('playing')
    expect(round.seats[1].status).toBe('playing')
  })

  it('seats players in the order they were entered', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const round = createRound(players, seeded(seed))
      expect(round.seats.map(seat => seat.playerId)).toEqual(['a', 'b'])
    }
  })

  it('never deals the same card twice', () => {
    const round = createRound(players, seeded(3))
    const dealt = [...round.seats.flatMap(seat => seat.cards), ...round.house, ...round.deck]
    expect(new Set(dealt.map(c => `${c.rank}-${c.suit}`)).size).toBe(52)
  })
})

describe('raiseBet', () => {
  it('stacks raises to reach any amount', () => {
    let round = createRound(players, seeded(4))
    round = raiseBet(round, 'a', 10)
    expect(round.seats[0].bet).toBe(ANTE + 10)

    round = raiseBet(raiseBet(round, 'a', 10), 'a', 1)
    expect(round.seats[0].bet).toBe(ANTE + 21)
    expect(round.seats[0].betLocked).toBe(false)
  })

  it('stops raising at the player\'s available cash', () => {
    let round = createRound(players, seeded(4))
    for (let i = 0; i < 12; i += 1) {
      round = raiseBet(round, 'a', 10)
    }
    expect(round.seats[0].bet).toBe(91)
    expect(raiseBet(round, 'a', 10).seats[0].bet).toBe(91)
    expect(raiseBet(round, 'a', 1).seats[0].bet).toBe(92)
  })

  it('refuses raises the player cannot cover', () => {
    const round = createRound([{ id: 'a', name: 'Ada', cash: 5 }, players[1]], seeded(5))
    expect(raiseBet(round, 'a', 100).seats[0].bet).toBe(ANTE)
  })

  it('is not allowed after twisting', () => {
    const round = twist(createRound(players, seeded(6)), 'a')
    expect(round.seats[0].betLocked).toBe(true)
    expect(raiseBet(round, 'a', 1).seats[0].bet).toBe(ANTE)
  })

  it('only affects the seat that raised', () => {
    const round = raiseBet(createRound(players, seeded(4)), 'a', 10)
    expect(round.seats[0].bet).toBe(ANTE + 10)
    expect(round.seats[1].bet).toBe(ANTE)
  })
})

describe('turns', () => {
  it('lets a seat stick without affecting the other seat', () => {
    const round = stick(createRound(players, seeded(7)), 'a')
    expect(round.seats[0].status).toBe('stood')
    expect(round.seats[1].status).toBe('playing')
    expect(round.phase).toBe('player')
  })

  it('hands over to the house once both seats have played', () => {
    let round = createRound(players, seeded(8))
    round = stick(stick(round, 'a'), 'b')
    expect(round.phase).toBe('house')
    expect(round.seats.every(seat => seat.status === 'stood')).toBe(true)
  })

  it('ends a seat\'s turn automatically on bust, without affecting the other seat', () => {
    let round = createRound(players, seeded(9))
    while (round.phase === 'player' && round.seats[0].status === 'playing') {
      round = twist(round, 'a')
    }
    expect(round.seats[0].status).toBe('bust')
    expect(round.seats[1].status).toBe('playing')
  })

  it('moves to the house once one seat busts and the other sticks', () => {
    let round = createRound(players, seeded(9))
    while (round.phase === 'player' && round.seats[0].status === 'playing') {
      round = twist(round, 'a')
    }
    round = stick(round, 'b')
    expect(round.phase).toBe('house')
  })

  it('ignores actions for a seat that is already done', () => {
    let round = createRound(players, seeded(10))
    round = stick(round, 'a')
    expect(twist(round, 'a')).toBe(round)
    expect(stick(round, 'a')).toBe(round)
  })

  it('ignores actions once the hand has moved on to the house', () => {
    let round = createRound(players, seeded(10))
    round = stick(stick(round, 'a'), 'b')
    expect(twist(round, 'a')).toBe(round)
    expect(stick(round, 'b')).toBe(round)
  })
})

describe('finishRound', () => {
  it('settles every player against the house', () => {
    let round = createRound(players, seeded(11))
    round = stick(stick(round, 'a'), 'b')
    round = finishRound(round)

    expect(round.phase).toBe('summary')
    expect(round.results).toHaveLength(2)
    for (const result of round.results!) {
      expect(result.cashAfter).toBe(result.cashBefore + result.delta)
      expect(Math.abs(result.delta)).toBe(result.outcome === 'push' ? 0 : result.bet)
    }
  })

  it('plays the house up to at least fifteen', () => {
    let round = createRound(players, seeded(12))
    round = finishRound(stick(stick(round, 'a'), 'b'))
    const houseCards = round.house
    expect(houseCards.length).toBeGreaterThanOrEqual(2)
  })

  it('does nothing before both players have finished', () => {
    const round = createRound(players, seeded(13))
    expect(finishRound(round)).toBe(round)
  })
})

describe('canAnte', () => {
  it('requires the entry fee', () => {
    expect(canAnte({ id: 'a', name: 'Ada', cash: 1 })).toBe(true)
    expect(canAnte({ id: 'a', name: 'Ada', cash: 0 })).toBe(false)
  })
})

describe('isRound', () => {
  it('accepts a round that has been through storage', () => {
    let round = createRound(players, seeded(14))
    round = raiseBet(twist(stick(round, 'a'), 'b'), 'b', 10)
    expect(isRound(JSON.parse(JSON.stringify(round)))).toBe(true)

    const settled = finishRound(stick(stick(round, 'a'), 'b'))
    expect(isRound(JSON.parse(JSON.stringify(settled)))).toBe(true)
  })

  it('rejects anything else', () => {
    const round = createRound(players, seeded(15))
    expect(isRound(undefined)).toBe(false)
    expect(isRound({})).toBe(false)
    expect(isRound({ ...round, phase: 'nonsense' })).toBe(false)
    expect(isRound({ ...round, seats: [] })).toBe(false)
    expect(isRound({ ...round, deck: [{ rank: 'Z', suit: 'spades' }] })).toBe(false)
    expect(isRound({ ...round, house: [{ rank: 'A', suit: 'swords' }] })).toBe(false)
    expect(isRound({ ...round, seats: [{ ...round.seats[0], betLocked: 'yes' }] })).toBe(false)
  })
})
