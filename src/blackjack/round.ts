import type { Player } from '../players'
import {
  ANTE,
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

export type SeatStatus = 'waiting' | 'playing' | 'stood' | 'bust'

export type Seat = {
  playerId: string
  name: string
  /** Cash held before this hand was settled. */
  cash: number
  cards: Card[]
  bet: number
  raised: boolean
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

export type Round = {
  deck: Card[]
  seats: Seat[]
  house: Card[]
  activeIndex: number
  phase: RoundPhase
  results: Result[] | null
}

/** Players need at least the ante to join a hand. */
export function canAnte(player: Player): boolean {
  return player.cash >= ANTE
}

/**
 * Deals a fresh hand: two cards each in a randomised seat order, with the
 * house dealt last.
 */
export function createRound(players: Player[], rng: Rng = Math.random): Round {
  const deck = shuffle(createDeck(), rng)
  const order = shuffle(players, rng)

  const seats: Seat[] = order.map(player => ({
    playerId: player.id,
    name: player.name,
    cash: player.cash,
    cards: [],
    bet: ANTE,
    raised: false,
    status: 'waiting' as SeatStatus,
  }))

  const house: Card[] = []
  for (let deal = 0; deal < 2; deal += 1) {
    for (const seat of seats) {
      seat.cards.push(deck.shift()!)
    }
    house.push(deck.shift()!)
  }

  const round: Round = {
    deck,
    seats,
    house,
    activeIndex: 0,
    phase: 'player',
    results: null,
  }

  return startSeat(round)
}

function startSeat(round: Round): Round {
  if (round.activeIndex >= round.seats.length) {
    return round
  }

  const seats = round.seats.map((seat, index) =>
    index === round.activeIndex ? { ...seat, status: 'playing' as SeatStatus } : seat,
  )
  return { ...round, seats }
}

function advance(round: Round): Round {
  const activeIndex = round.activeIndex + 1
  if (activeIndex >= round.seats.length) {
    return { ...round, activeIndex, phase: 'house' }
  }
  return startSeat({ ...round, activeIndex })
}

function updateActiveSeat(round: Round, update: (seat: Seat) => Seat): Round {
  const seats = round.seats.map((seat, index) => (index === round.activeIndex ? update(seat) : seat))
  return { ...round, seats }
}

/** Increases the active player's bet. Each player may only raise once. */
export function raiseBet(round: Round, amount: number): Round {
  const seat = round.seats[round.activeIndex]
  if (round.phase !== 'player' || !seat || seat.raised || seat.bet + amount > seat.cash) {
    return round
  }
  return updateActiveSeat(round, current => ({ ...current, bet: current.bet + amount, raised: true }))
}

/** Deals the active player another card, ending their turn if they go bust. */
export function twist(round: Round): Round {
  const seat = round.seats[round.activeIndex]
  if (round.phase !== 'player' || !seat || round.deck.length === 0) {
    return round
  }

  const [card, ...deck] = round.deck
  const cards = [...seat.cards, card]
  const bust = isBust(cards)
  const next = updateActiveSeat({ ...round, deck }, current => ({
    ...current,
    cards,
    raised: true,
    status: bust ? 'bust' : 'playing',
  }))

  return bust ? advance(next) : next
}

/** Ends the active player's turn, keeping their current hand. */
export function stick(round: Round): Round {
  const seat = round.seats[round.activeIndex]
  if (round.phase !== 'player' || !seat) {
    return round
  }

  const next = updateActiveSeat(round, current => ({ ...current, status: 'stood' as SeatStatus }))
  return advance(next)
}

/** Plays the house hand out and settles every player against it. */
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
