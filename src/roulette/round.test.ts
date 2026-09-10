import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import {
  activeSeat,
  clearBet,
  clearBets,
  createRound,
  endTurn,
  finishSpin,
  isRound,
  nextRound,
  placeChip,
  remaining,
  seatOf,
  staked,
  type Round,
} from './round'
import { WHEEL } from './wheel'

const players: Player[] = [
  { id: 'a', name: 'Ann', cash: 100 },
  { id: 'b', name: 'Ben', cash: 20 },
]

/** Lands the ball on a chosen pocket. */
function landOn(pocket: number) {
  return () => WHEEL.indexOf(pocket) / WHEEL.length
}

function bothDone(round: Round, pocket: number): Round {
  return endTurn(endTurn(round, round.seats[round.turn].playerId, landOn(pocket)), round.seats[(round.turn + 1) % 2].playerId, landOn(pocket))
}

describe('roulette round', () => {
  it('starts with the opener betting and nothing staked', () => {
    const round = createRound(players)
    expect(round.phase).toBe('betting')
    expect(activeSeat(round)?.playerId).toBe('a')
    expect(staked(round.seats[0])).toBe(0)
    expect(remaining(round.seats[1])).toBe(20)
    expect(isRound(round)).toBe(true)
  })

  it('stacks chips on a spot, up to the cash held', () => {
    let round = createRound(players)
    round = placeChip(round, 'a', 'red', 10)
    round = placeChip(round, 'a', 'red', 5)
    round = placeChip(round, 'a', 'straight-7', 1)

    const seat = seatOf(round, 'a')!
    expect(seat.bets).toEqual({ red: 15, 'straight-7': 1 })
    expect(staked(seat)).toBe(16)

    // More than the seat can cover is ignored.
    round = placeChip(round, 'a', 'black', 100)
    expect(staked(seatOf(round, 'a')!)).toBe(16)
  })

  it('only lets the player whose turn it is bet', () => {
    const round = placeChip(createRound(players), 'b', 'red', 5)
    expect(staked(seatOf(round, 'b')!)).toBe(0)
    expect(placeChip(round, 'a', 'nonsense', 5)).toBe(round)
  })

  it('takes bets back off the board', () => {
    let round = placeChip(placeChip(createRound(players), 'a', 'red', 5), 'a', 'even', 5)
    round = clearBet(round, 'a', 'red')
    expect(seatOf(round, 'a')!.bets).toEqual({ even: 5 })

    round = clearBets(round, 'a')
    expect(staked(seatOf(round, 'a')!)).toBe(0)
  })

  it('passes the turn on, then spins once both have bet', () => {
    let round = placeChip(createRound(players), 'a', 'red', 10)
    round = endTurn(round, 'a')
    expect(round.phase).toBe('betting')
    expect(activeSeat(round)?.playerId).toBe('b')

    round = placeChip(round, 'b', 'straight-7', 5)
    round = endTurn(round, 'b', landOn(7))
    expect(round.phase).toBe('spinning')
    expect(round.pocket).toBe(7)
    expect(activeSeat(round)).toBeNull()
    expect(isRound(round)).toBe(true)
  })

  it('ignores an end of turn from the waiting player', () => {
    const round = createRound(players)
    expect(endTurn(round, 'b')).toBe(round)
  })

  it('settles winning and losing bets against the pocket', () => {
    let round = createRound(players)
    round = placeChip(round, 'a', 'straight-7', 1)
    round = placeChip(round, 'a', 'black', 10)
    round = endTurn(round, 'a')
    round = placeChip(round, 'b', 'red', 5)
    round = endTurn(round, 'b', landOn(7))
    round = finishSpin(round)

    expect(round.phase).toBe('summary')
    const [ann, ben] = round.results!
    // 7 is red: the straight up pays 35, the black bet loses its tenner.
    expect(ann.delta).toBe(25)
    expect(ann.staked).toBe(11)
    expect(ann.cashAfter).toBe(125)
    expect(ann.bets.find(bet => bet.betId === 'straight-7')).toMatchObject({ won: true, delta: 35 })
    expect(ann.bets.find(bet => bet.betId === 'black')).toMatchObject({ won: false, delta: -10 })
    expect(ben.delta).toBe(5)
    expect(ben.cashAfter).toBe(25)
  })

  it('takes everything on zero except a bet on zero', () => {
    let round = placeChip(createRound(players), 'a', 'red', 10)
    round = placeChip(round, 'a', 'straight-0', 1)
    round = finishSpin(bothDone(round, 0))

    const ann = round.results![0]
    expect(ann.delta).toBe(25)
  })

  it('only settles a spinning round', () => {
    const round = createRound(players)
    expect(finishSpin(round)).toBe(round)
  })

  it('alternates who opens the betting', () => {
    const first = createRound(players)
    const second = nextRound(first, players)
    expect(second.opener).toBe(1)
    expect(activeSeat(second)?.playerId).toBe('b')
    expect(nextRound(second, players).opener).toBe(0)
  })

  it('rejects stored rounds that have been tampered with', () => {
    expect(isRound(null)).toBe(false)
    expect(isRound({ ...createRound(players), phase: 'wat' })).toBe(false)
    expect(isRound({ ...createRound(players), pocket: 42 })).toBe(false)
    expect(isRound({ ...createRound(players), turn: 5 })).toBe(false)
    const bad = createRound(players)
    bad.seats[0].bets = { nonsense: 5 }
    expect(isRound(bad)).toBe(false)
  })
})
