import { describe, expect, it } from 'vitest'
import type { Player } from '../players'
import {
  clearBet,
  clearBets,
  createRound,
  finishSpin,
  isRound,
  nextRound,
  placeChip,
  remaining,
  seatOf,
  staked,
  startSpin,
} from './round'
import { WHEEL } from './wheel'
import { BALL_SPEED, MAX_BALL_SPEED, MIN_BALL_SPEED } from './spin'

const players: Player[] = [
  { id: 'a', name: 'Ann', cash: 100 },
  { id: 'b', name: 'Ben', cash: 20 },
]

/** Lands the ball on a chosen pocket. */
function landOn(pocket: number) {
  return () => WHEEL.indexOf(pocket) / WHEEL.length
}

describe('roulette round', () => {
  it('starts with both players free to bet and nothing staked', () => {
    const round = createRound(players)
    expect(round.phase).toBe('betting')
    expect(round.seats.map(staked)).toEqual([0, 0])
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

  it('lets either player bet in any order, only against their own balance', () => {
    let round = placeChip(createRound(players), 'b', 'red', 5)
    round = placeChip(round, 'a', 'black', 10)
    round = placeChip(round, 'b', 'even', 1)
    expect(seatOf(round, 'a')!.bets).toEqual({ black: 10 })
    expect(seatOf(round, 'b')!.bets).toEqual({ red: 5, even: 1 })
    expect(placeChip(round, 'a', 'nonsense', 5)).toBe(round)
    expect(placeChip(round, 'unknown', 'red', 5)).toBe(round)
    expect(placeChip(round, 'b', 'black', 100)).toBe(round)
    expect(placeChip(round, 'b', 'black', Number.NaN)).toBe(round)
  })

  it('takes only the selected player’s bets back off the board', () => {
    let round = placeChip(placeChip(createRound(players), 'a', 'red', 5), 'a', 'even', 5)
    round = placeChip(round, 'b', 'red', 1)
    round = clearBet(round, 'a', 'red')
    expect(seatOf(round, 'a')!.bets).toEqual({ even: 5 })
    expect(seatOf(round, 'b')!.bets).toEqual({ red: 1 })

    round = clearBets(round, 'a')
    expect(staked(seatOf(round, 'a')!)).toBe(0)
    expect(staked(seatOf(round, 'b')!)).toBe(1)
  })

  it('starts one spin as soon as either player has staked anything', () => {
    const empty = createRound(players)
    expect(startSpin(empty, landOn(7))).toBe(empty)
    const roundWithBet = placeChip(empty, 'b', 'straight-7', 5)
    expect(roundWithBet.pocket).toBeNull()
    const round = startSpin(roundWithBet, landOn(7))
    expect(round.phase).toBe('spinning')
    expect(round.pocket).toBe(7)
    expect(round.ballStartSpeed).toBeGreaterThanOrEqual(MIN_BALL_SPEED)
    expect(round.ballStartSpeed).toBeLessThanOrEqual(MAX_BALL_SPEED)
    expect(startSpin(round)).toBe(round)
    expect(placeChip(round, 'a', 'red', 1)).toBe(round)
    expect(clearBet(round, 'b', 'straight-7')).toBe(round)
    expect(clearBets(round, 'b')).toBe(round)
  })

  it('chooses throw speed independently of the pocket and keeps it through settlement', () => {
    const withStake = placeChip(createRound(players), 'a', 'red', 1)
    const pocketIndex = WHEEL.indexOf(7) / WHEEL.length
    const lowValues = [pocketIndex, 0][Symbol.iterator]()
    const low = startSpin(withStake, () => lowValues.next().value!)
    const highValues = [pocketIndex, 1][Symbol.iterator]()
    const high = startSpin(withStake, () => highValues.next().value!)
    expect(low.pocket).toBe(7)
    expect(high.pocket).toBe(7)
    expect(low.ballStartSpeed).toBe(MIN_BALL_SPEED)
    expect(high.ballStartSpeed).toBe(MAX_BALL_SPEED)
    expect(finishSpin(high).ballStartSpeed).toBe(MAX_BALL_SPEED)
  })

  it('allows the remaining player to spin when the other has no cash', () => {
    const withEmptySeat = createRound([players[0], { ...players[1], cash: 0 }])
    expect(placeChip(withEmptySeat, 'b', 'red', 1)).toBe(withEmptySeat)
    const withStake = placeChip(withEmptySeat, 'a', 'red', 1)
    const settled = finishSpin(startSpin(withStake, landOn(7)))
    expect(settled.results?.map(result => result.cashAfter)).toEqual([101, 0])
  })

  it('does not spin after the only stake is cleared', () => {
    let round = placeChip(createRound(players), 'a', 'red', 1)
    round = clearBet(round, 'a', 'red')
    expect(startSpin(round, landOn(7))).toBe(round)
    round = placeChip(round, 'b', 'straight-7', 1)
    round = startSpin(round, landOn(7))
    expect(round.phase).toBe('spinning')
  })

  it('settles winning and losing bets against the pocket', () => {
    let round = createRound(players)
    round = placeChip(round, 'a', 'straight-7', 1)
    round = placeChip(round, 'a', 'black', 10)
    round = placeChip(round, 'b', 'red', 5)
    round = startSpin(round, landOn(7))
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
    round = finishSpin(startSpin(round, landOn(0)))

    const ann = round.results![0]
    expect(ann.delta).toBe(25)
  })

  it('only settles a spinning round', () => {
    const round = createRound(players)
    expect(finishSpin(round)).toBe(round)
  })

  it('starts the next spin with both players able to bet again', () => {
    const first = createRound(players)
    const second = nextRound(players)
    expect(second).toEqual(first)
    expect(placeChip(second, 'b', 'red', 1).seats[1].bets).toEqual({ red: 1 })
  })

  it('rejects stored rounds that have been tampered with', () => {
    expect(isRound(null)).toBe(false)
    expect(isRound({ ...createRound(players), phase: 'wat' })).toBe(false)
    expect(isRound({ ...createRound(players), pocket: 42 })).toBe(false)
    expect(isRound({ ...createRound(players), ballStartSpeed: Number.NaN })).toBe(false)
    expect(isRound({ ...createRound(players), ballStartSpeed: MIN_BALL_SPEED - 1 })).toBe(false)
    expect(isRound({ ...createRound(players), ballStartSpeed: BALL_SPEED })).toBe(true)
    expect(isRound({ ...createRound(players), phase: 'ready' })).toBe(true)
    expect(isRound({ ...createRound(players), phase: 'spinning', pocket: 7 })).toBe(true)
    const savedReady = { ...placeChip(createRound(players), 'a', 'red', 1), phase: 'ready' as const }
    expect(placeChip(savedReady, 'b', 'black', 1).seats[1].bets).toEqual({ black: 1 })
    expect(startSpin(savedReady, landOn(7)).phase).toBe('spinning')
    const bad = createRound(players)
    bad.seats[0].bets = { nonsense: 5 }
    expect(isRound(bad)).toBe(false)
  })
})
