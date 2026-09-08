import type { Suit } from './games'

export type { Suit }

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export type Card = {
  rank: Rank
  suit: Suit
}

export type Rng = () => number

export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export function createDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ rank, suit })))
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function isCard(value: unknown): value is Card {
  const card = value as Partial<Card>
  return (
    typeof value === 'object' &&
    value !== null &&
    RANKS.includes(card.rank!) &&
    SUITS.includes(card.suit!)
  )
}

export function isCardList(value: unknown): value is Card[] {
  return Array.isArray(value) && value.every(isCard)
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`
}

/** Position of a rank in a run, aces low. */
export function rankOrder(rank: Rank): number {
  return RANKS.indexOf(rank)
}
