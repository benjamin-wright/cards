import type { Player } from '../players'
import { betSpot, isBetId } from './bets'
import { isPocket, spinWheel, type Rng } from './wheel'

export type Phase = 'betting' | 'spinning' | 'summary'

const PHASES: Phase[] = ['betting', 'spinning', 'summary']

export type Seat = {
  playerId: string
  name: string
  /** Cash held before this spin is settled. */
  cash: number
  /** Stake on each bet spot, keyed by spot id. */
  bets: Record<string, number>
  /** True once this player has finished placing bets for the spin. */
  done: boolean
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
 * Players take it in turns to place their chips on the shared board, then the
 * wheel is spun once for both of them.
 */
export type Round = {
  seats: Seat[]
  /** Index of the seat placing bets. */
  turn: number
  /** Index of the seat that opened the betting, so turns alternate. */
  opener: number
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
    typeof seat.done === 'boolean' &&
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
    typeof round.turn === 'number' &&
    round.turn >= 0 &&
    round.turn < round.seats.length &&
    typeof round.opener === 'number' &&
    round.opener >= 0 &&
    round.opener < round.seats.length &&
    PHASES.includes(round.phase!) &&
    (round.pocket === null || isPocket(round.pocket)) &&
    (round.results === null || Array.isArray(round.results))
  )
}

export function createRound(players: Player[], firstToBet = 0): Round {
  const opener = players.length === 0 ? 0 : firstToBet % players.length

  return {
    seats: players.map(player => ({
      playerId: player.id,
      name: player.name,
      cash: player.cash,
      bets: {},
      done: false,
    })),
    turn: opener,
    opener,
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

/** The seat whose turn it is to place chips, or null once betting is closed. */
export function activeSeat(round: Round): Seat | null {
  return round.phase === 'betting' ? round.seats[round.turn] ?? null : null
}

function updateSeat(round: Round, playerId: string, update: (seat: Seat) => Seat): Round {
  return { ...round, seats: round.seats.map(seat => (seat.playerId === playerId ? update(seat) : seat)) }
}

export function canPlaceChip(round: Round, playerId: string, betId: string, chip: number): boolean {
  const seat = activeSeat(round)
  return (
    seat !== null && seat.playerId === playerId && !seat.done && isBetId(betId) && chip > 0 && remaining(seat) >= chip
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
  const seat = activeSeat(round)
  if (seat === null || seat.playerId !== playerId || seat.bets[betId] === undefined) return round

  return updateSeat(round, playerId, current => {
    const bets = { ...current.bets }
    delete bets[betId]
    return { ...current, bets }
  })
}

export function clearBets(round: Round, playerId: string): Round {
  const seat = activeSeat(round)
  if (seat === null || seat.playerId !== playerId) return round
  return updateSeat(round, playerId, current => ({ ...current, bets: {} }))
}

/**
 * Ends a player's betting turn. The wheel starts turning once everyone has
 * had their go, with the winning pocket chosen up front so a refresh part way
 * through the spin still settles on the same number.
 */
export function endTurn(round: Round, playerId: string, rng: Rng = Math.random): Round {
  const seat = activeSeat(round)
  if (seat === null || seat.playerId !== playerId) return round

  const seats = round.seats.map(entry => (entry.playerId === playerId ? { ...entry, done: true } : entry))
  const next = seats.findIndex(entry => !entry.done)

  if (next < 0) {
    return { ...round, seats, phase: 'spinning', pocket: spinWheel(rng) }
  }

  return { ...round, seats, turn: next }
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

/** Deals the next spin, with the other player opening the betting. */
export function nextRound(round: Round, players: Player[]): Round {
  const opener = round.seats.length === 0 ? 0 : (round.opener + 1) % round.seats.length
  return createRound(players, opener)
}
