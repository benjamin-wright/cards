import type { Player } from '../players'
import { betSpot, isBetId } from './bets'
import { isPocket, spinWheel, type Rng } from './wheel'

/** Ready is accepted for spins saved by the previous turn-based version. */
export type Phase = 'betting' | 'ready' | 'spinning' | 'summary'

const PHASES: Phase[] = ['betting', 'ready', 'spinning', 'summary']

export type Seat = {
  playerId: string
  name: string
  /** Cash held before this spin is settled. */
  cash: number
  /** Stake on each bet spot, keyed by spot id. */
  bets: Record<string, number>
}

export type BetResult = {
  betId: string
  label: string
  stake: number
  won: boolean
  delta: number
}

export type Result = {
  playerId: string
  name: string
  staked: number
  delta: number
  cashBefore: number
  cashAfter: number
  bets: BetResult[]
}

/**
 * Either player may place bets until the wheel is spun for both of them.
 */
export type Round = {
  seats: Seat[]
  phase: Phase
  /** The winning pocket, chosen as the wheel starts turning. */
  pocket: number | null
  results: Result[] | null
}

function isBets(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.entries(value).every(([id, stake]) => isBetId(id) && typeof stake === 'number' && Number.isFinite(stake))
  )
}

function isSeat(value: unknown): value is Seat {
  const seat = value as Partial<Seat>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof seat.playerId === 'string' &&
    typeof seat.name === 'string' &&
    typeof seat.cash === 'number' &&
    isBets(seat.bets)
  )
}

/** Guards a round restored from storage, so bad data starts a fresh spin. */
export function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(round.seats) &&
    round.seats.length > 0 &&
    round.seats.every(isSeat) &&
    PHASES.includes(round.phase!) &&
    (round.pocket === null || isPocket(round.pocket)) &&
    (round.results === null || Array.isArray(round.results))
  )
}

export function createRound(players: Player[]): Round {
  return {
    seats: players.map(player => ({
      playerId: player.id,
      name: player.name,
      cash: player.cash,
      bets: {},
    })),
    phase: 'betting',
    pocket: null,
    results: null,
  }
}

export function staked(seat: Seat): number {
  return Object.values(seat.bets).reduce((total, stake) => total + stake, 0)
}

/** Cash the seat still has free to stake this spin. */
export function remaining(seat: Seat): number {
  return seat.cash - staked(seat)
}

export function seatOf(round: Round, playerId: string): Seat | null {
  return round.seats.find(seat => seat.playerId === playerId) ?? null
}

function updateSeat(round: Round, playerId: string, update: (seat: Seat) => Seat): Round {
  return { ...round, seats: round.seats.map(seat => (seat.playerId === playerId ? update(seat) : seat)) }
}

export function canPlaceChip(round: Round, playerId: string, betId: string, chip: number): boolean {
  const seat = seatOf(round, playerId)
  return (
    (round.phase === 'betting' || round.phase === 'ready') && seat !== null && isBetId(betId) &&
    Number.isFinite(chip) && chip > 0 && remaining(seat) >= chip
  )
}

/** Adds a chip to a bet spot. Chips stack, so any stake can be built up. */
export function placeChip(round: Round, playerId: string, betId: string, chip: number): Round {
  if (!canPlaceChip(round, playerId, betId, chip)) return round

  return updateSeat(round, playerId, seat => ({
    ...seat,
    bets: { ...seat.bets, [betId]: (seat.bets[betId] ?? 0) + chip },
  }))
}

/** Takes a whole stake back off the board. */
export function clearBet(round: Round, playerId: string, betId: string): Round {
  const seat = seatOf(round, playerId)
  if ((round.phase !== 'betting' && round.phase !== 'ready') || seat === null || seat.bets[betId] === undefined) return round

  return updateSeat(round, playerId, current => {
    const bets = { ...current.bets }
    delete bets[betId]
    return { ...current, bets }
  })
}

export function clearBets(round: Round, playerId: string): Round {
  const seat = seatOf(round, playerId)
  if ((round.phase !== 'betting' && round.phase !== 'ready') || seat === null) return round
  return updateSeat(round, playerId, current => ({ ...current, bets: {} }))
}

/** Starts the public spin, fixing its pocket so refreshes cannot re-roll it. */
export function startSpin(round: Round, rng: Rng = Math.random): Round {
  if ((round.phase !== 'betting' && round.phase !== 'ready') || !round.seats.some(seat => staked(seat) > 0)) return round
  return { ...round, phase: 'spinning', pocket: spinWheel(rng) }
}

/** Settles every seat against the pocket the ball landed in. */
export function finishSpin(round: Round): Round {
  if (round.phase !== 'spinning' || round.pocket === null) return round

  const pocket = round.pocket
  const results: Result[] = round.seats.map(seat => {
    const bets: BetResult[] = Object.entries(seat.bets).map(([betId, stake]) => {
      const spot = betSpot(betId)!
      const won = spot.numbers.includes(pocket)
      return { betId, label: spot.label, stake, won, delta: won ? stake * spot.payout : -stake }
    })

    const delta = bets.reduce((total, bet) => total + bet.delta, 0)

    return {
      playerId: seat.playerId,
      name: seat.name,
      staked: staked(seat),
      delta,
      cashBefore: seat.cash,
      cashAfter: seat.cash + delta,
      bets,
    }
  })

  return { ...round, phase: 'summary', results }
}

/** Deals the next spin for both players. */
export function nextRound(players: Player[]): Round {
  return createRound(players)
}
