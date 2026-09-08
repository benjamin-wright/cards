import type { Player } from '../players'
import {
  ANTE,
  RANKS,
  SUITS,
  type Card,
  type Outcome,
  type Rng,
  createDeck,
  handScore,
  isBust,
  payout,
  playHouse,
  settle,
  shuffle,
} from './engine'

export type SeatStatus = 'playing' | 'stood' | 'bust'

const SEAT_STATUSES: SeatStatus[] = ['playing', 'stood', 'bust']

export type Seat = {
  playerId: string
  name: string
  /** Cash held before this hand was settled. */
  cash: number
  cards: Card[]
  bet: number
  /** Betting closes for a seat once they take another card. */
  betLocked: boolean
  status: SeatStatus
}

export type Result = {
  playerId: string
  name: string
  score: number
  bet: number
  outcome: Outcome
  delta: number
  cashBefore: number
  cashAfter: number
}

export type RoundPhase = 'player' | 'house' | 'summary'

const ROUND_PHASES: RoundPhase[] = ['player', 'house', 'summary']

/**
 * Both seats play at once — there's no turn order, just each seat's own
 * progress towards standing or going bust.
 */
export type Round = {
  deck: Card[]
  seats: Seat[]
  house: Card[]
  phase: RoundPhase
  results: Result[] | null
}

function isCardList(value: unknown): value is Card[] {
  return (
    Array.isArray(value) &&
    value.every(entry => {
      const card = entry as Partial<Card>
      return typeof entry === 'object' && entry !== null && RANKS.includes(card.rank!) && SUITS.includes(card.suit!)
    })
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
    typeof seat.bet === 'number' &&
    typeof seat.betLocked === 'boolean' &&
    SEAT_STATUSES.includes(seat.status!) &&
    isCardList(seat.cards)
  )
}

/** Guards a round restored from storage, so bad data starts a fresh hand. */
export function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>
  return (
    typeof value === 'object' &&
    value !== null &&
    isCardList(round.deck) &&
    isCardList(round.house) &&
    Array.isArray(round.seats) &&
    round.seats.length > 0 &&
    round.seats.every(isSeat) &&
    ROUND_PHASES.includes(round.phase!) &&
    (round.results === null || Array.isArray(round.results))
  )
}

/** Players need at least the ante to join a hand. */
export function canAnte(player: Player): boolean {
  return player.cash >= ANTE
}

/**
 * Deals a fresh hand: two cards each in player order, with the house dealt
 * last. Both seats start able to play at the same time.
 */
export function createRound(players: Player[], rng: Rng = Math.random): Round {
  const deck = shuffle(createDeck(), rng)

  const seats: Seat[] = players.map(player => ({
    playerId: player.id,
    name: player.name,
    cash: player.cash,
    cards: [],
    bet: ANTE,
    betLocked: false,
    status: 'playing' as SeatStatus,
  }))

  const house: Card[] = []
  for (let deal = 0; deal < 2; deal += 1) {
    for (const seat of seats) {
      seat.cards.push(deck.shift()!)
    }
    house.push(deck.shift()!)
  }

  return {
    deck,
    seats,
    house,
    phase: 'player',
    results: null,
  }
}

function updateSeat(round: Round, playerId: string, update: (seat: Seat) => Seat): Round {
  const seats = round.seats.map(seat => (seat.playerId === playerId ? update(seat) : seat))
  return { ...round, seats }
}

/** Hands over to the house once every seat has stood or gone bust. */
function afterAction(round: Round): Round {
  if (round.phase === 'player' && round.seats.every(seat => seat.status !== 'playing')) {
    return { ...round, phase: 'house' }
  }
  return round
}

/**
 * Increases a seat's bet. Raises can be stacked to reach any amount, up
 * until that seat takes another card.
 */
export function raiseBet(round: Round, playerId: string, amount: number): Round {
  const seat = round.seats.find(entry => entry.playerId === playerId)
  if (round.phase !== 'player' || !seat || seat.status !== 'playing' || seat.betLocked || seat.bet + amount > seat.cash) {
    return round
  }
  return updateSeat(round, playerId, current => ({ ...current, bet: current.bet + amount }))
}

/** Deals a seat another card, ending their turn if they go bust. */
export function twist(round: Round, playerId: string): Round {
  const seat = round.seats.find(entry => entry.playerId === playerId)
  if (round.phase !== 'player' || !seat || seat.status !== 'playing' || round.deck.length === 0) {
    return round
  }

  const [card, ...deck] = round.deck
  const cards = [...seat.cards, card]
  const bust = isBust(cards)
  const next = updateSeat({ ...round, deck }, playerId, current => ({
    ...current,
    cards,
    betLocked: true,
    status: bust ? 'bust' : 'playing',
  }))

  return afterAction(next)
}

/** Ends a seat's turn, keeping their current hand. */
export function stick(round: Round, playerId: string): Round {
  const seat = round.seats.find(entry => entry.playerId === playerId)
  if (round.phase !== 'player' || !seat || seat.status !== 'playing') {
    return round
  }

  const next = updateSeat(round, playerId, current => ({ ...current, status: 'stood' as SeatStatus }))
  return afterAction(next)
}

/** Plays the house hand out and settles every seat against it. */
export function finishRound(round: Round): Round {
  if (round.phase !== 'house') {
    return round
  }

  const { cards: house, deck } = playHouse(round.house, round.deck)

  const results: Result[] = round.seats.map(seat => {
    const outcome = settle(seat.cards, house)
    const delta = payout(outcome, seat.bet)
    return {
      playerId: seat.playerId,
      name: seat.name,
      score: handScore(seat.cards),
      bet: seat.bet,
      outcome,
      delta,
      cashBefore: seat.cash,
      cashAfter: seat.cash + delta,
    }
  })

  return { ...round, deck, house, phase: 'summary', results }
}
