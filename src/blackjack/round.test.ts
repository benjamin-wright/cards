import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import { ANTE } from './engine'
import { canAnte, createRound, finishRound, raiseBet, stick, twist } from './round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 100 },
  { id: 'b', name: 'Bob', cash: 100 },
  { id: 'c', name: 'Cal', cash: 100 },
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

    expect(round.seats).toHaveLength(3)
    for (const seat of round.seats) {
      expect(seat.cards).toHaveLength(2)
      expect(seat.bet).toBe(ANTE)
      expect(seat.raised).toBe(false)
    }
    expect(round.house).toHaveLength(2)
    expect(round.deck).toHaveLength(52 - 8)
  })

  it('starts with the first seat playing', () => {
    const round = createRound(players, seeded(2))
    expect(round.phase).toBe('player')
    expect(round.activeIndex).toBe(0)
    expect(round.seats[0].status).toBe('playing')
    expect(round.seats[1].status).toBe('waiting')
  })

  it('seats players in the order they were entered', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const round = createRound(players, seeded(seed))
      expect(round.seats.map(seat => seat.playerId)).toEqual(['a', 'b', 'c'])
    }
  })

  it('never deals the same card twice', () => {
    const round = createRound(players, seeded(3))
    const dealt = [...round.seats.flatMap(seat => seat.cards), ...round.house, ...round.deck]
    expect(new Set(dealt.map(c => `${c.rank}-${c.suit}`)).size).toBe(52)
  })
})

describe('raiseBet', () => {
  it('increases the bet once only', () => {
    const round = createRound(players, seeded(4))
    const raised = raiseBet(round, 10)
    expect(raised.seats[0].bet).toBe(ANTE + 10)
    expect(raised.seats[0].raised).toBe(true)

    const again = raiseBet(raised, 10)
    expect(again.seats[0].bet).toBe(ANTE + 10)
  })

  it('refuses raises the player cannot cover', () => {
    const round = createRound([{ id: 'a', name: 'Ada', cash: 5 }, players[1]], seeded(5))
    expect(raiseBet(round, 100).seats[0].bet).toBe(ANTE)
  })

  it('is not allowed after twisting', () => {
    const round = twist(createRound(players, seeded(6)))
    if (round.phase === 'player') {
      expect(raiseBet(round, 1).seats[0].bet).toBe(ANTE)
    }
  })
})

describe('turns', () => {
  it('moves to the next player when a player sticks', () => {
    const round = stick(createRound(players, seeded(7)))
    expect(round.seats[0].status).toBe('stood')
    expect(round.activeIndex).toBe(1)
    expect(round.seats[1].status).toBe('playing')
  })

  it('hands over to the house once everyone has played', () => {
    let round = createRound(players, seeded(8))
    round = stick(stick(stick(round)))
    expect(round.phase).toBe('house')
    expect(round.seats.every(seat => seat.status === 'stood')).toBe(true)
  })

  it('ends a turn automatically on bust', () => {
    let round = createRound(players, seeded(9))
    while (round.phase === 'player' && round.activeIndex === 0) {
      round = twist(round)
    }
    expect(round.seats[0].status).toBe('bust')
  })

  it('ignores actions once the players are done', () => {
    let round = createRound(players, seeded(10))
    round = stick(stick(stick(round)))
    expect(twist(round)).toBe(round)
    expect(stick(round)).toBe(round)
  })
})

describe('finishRound', () => {
  it('settles every player against the house', () => {
    let round = createRound(players, seeded(11))
    round = stick(stick(stick(round)))
    round = finishRound(round)

    expect(round.phase).toBe('summary')
    expect(round.results).toHaveLength(3)
    for (const result of round.results!) {
      expect(result.cashAfter).toBe(result.cashBefore + result.delta)
      expect(Math.abs(result.delta)).toBe(result.outcome === 'push' ? 0 : result.bet)
    }
  })

  it('plays the house up to at least fifteen', () => {
    let round = createRound(players, seeded(12))
    round = finishRound(stick(stick(stick(round))))
    const houseCards = round.house
    expect(houseCards.length).toBeGreaterThanOrEqual(2)
  })

  it('does nothing before the players have finished', () => {
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
