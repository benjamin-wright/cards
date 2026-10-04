import type { Player } from '../players'
import { createDeck, isCardList, shuffle, type Card, type Rng } from '../cards'
import { compareHands, handScore, isBust } from './engine'

export type SeatStatus = 'waiting' | 'playing' | 'stood' | 'bust'

export type Seat = {
  playerId: string
  name: string
  cards: Card[]
  status: SeatStatus
}

export type RoundResult = {
  winnerId: string | null
  scores: { playerId: string; score: number }[]
}

export type Round = {
  deck: Card[]
  seats: Seat[]
  result: RoundResult | null
}

/** Guards a persisted hand, including rounds saved under the old turn order. */
export function isRound(value: unknown): value is Round {
  if (typeof value !== 'object' || value === null) return false
  const round = value as Partial<Round>
  if (!isCardList(round.deck) || !Array.isArray(round.seats) || round.seats.length !== 2) return false
  if (!round.seats.every((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return false
    const seat = entry as Partial<Seat>
    return typeof seat.playerId === 'string' && typeof seat.name === 'string' &&
      isCardList(seat.cards) && ['waiting', 'playing', 'stood', 'bust'].includes(seat.status!)
  })) return false
  const [first, second] = round.seats as Seat[]
  if (first.playerId === second.playerId) return false
  if (round.result === null) {
    return true
  }
  const result = round.result as Partial<RoundResult> | undefined
  return result !== undefined && result !== null &&
    (result.winnerId === null || result.winnerId === first.playerId || result.winnerId === second.playerId) &&
    Array.isArray(result.scores) && result.scores.length === 2 &&
    result.scores.every((entry, index) =>
      typeof entry === 'object' && entry !== null &&
      entry.playerId === round.seats![index].playerId && typeof entry.score === 'number' && Number.isFinite(entry.score)) &&
    round.seats.every((seat: Seat) => seat.status === 'stood' || seat.status === 'bust')
}

/** Deal two private cards to each player; either seat may play first. */
export function createRound(players: Player[], rng: Rng = Math.random): Round {
  const deck = shuffle(createDeck(), rng)
  const seats: Seat[] = players.map(player => ({
    playerId: player.id,
    name: player.name,
    cards: [],
    status: 'playing',
  }))
  for (let deal = 0; deal < 2; deal += 1) {
    for (const seat of seats) seat.cards.push(deck.shift()!)
  }
  return { deck, seats, result: null }
}

/** Only score after both players have finished and chosen to share their hands. */
export function revealHands(round: Round): Round {
  if (round.result !== null ||
    !round.seats.every(seat => seat.status === 'stood' || seat.status === 'bust')) return round
  const [first, second] = round.seats
  const comparison = compareHands(first.cards, second.cards)
  return {
    ...round,
    result: {
      winnerId: comparison === 0 ? null : comparison > 0 ? first.playerId : second.playerId,
      scores: round.seats.map(seat => ({ playerId: seat.playerId, score: handScore(seat.cards) })),
    },
  }
}

export function twist(round: Round, playerId: string): Round {
  const seat = round.seats.find(entry => entry.playerId === playerId)
  if (round.result !== null || !seat || (seat.status !== 'playing' && seat.status !== 'waiting') ||
    round.deck.length === 0) return round
  const [card, ...deck] = round.deck
  const seats = round.seats.map(seat => {
    if (seat.playerId !== playerId) return seat
    const cards = [...seat.cards, card]
    return { ...seat, cards, status: isBust(cards) ? 'bust' : 'playing' } as Seat
  })
  return { ...round, deck, seats }
}

export function stick(round: Round, playerId: string): Round {
  const seat = round.seats.find(entry => entry.playerId === playerId)
  if (round.result !== null || !seat || (seat.status !== 'playing' && seat.status !== 'waiting')) return round
  return {
    ...round,
    seats: round.seats.map(seat => seat.playerId === playerId ? { ...seat, status: 'stood' } as Seat : seat),
  }
}
