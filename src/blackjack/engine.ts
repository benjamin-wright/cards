import type { Card, Rank } from '../cards'

export type { Card, Rank, Rng } from '../cards'
export { RANKS, SUITS, createDeck, shuffle } from '../cards'

export const TARGET_SCORE = 21

function cardValue(rank: Rank): number {
  if (rank === 'A') return 1
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 10
  return Number(rank)
}

/**
 * Best score for a hand: aces count as 1 or 11, whichever favours the player
 * without going bust.
 */
export function handScore(cards: Card[]): number {
  let score = cards.reduce((total, card) => total + cardValue(card.rank), 0)
  const aces = cards.filter(card => card.rank === 'A').length
  for (let i = 0; i < aces; i += 1) {
    if (score + 10 <= TARGET_SCORE) {
      score += 10
    }
  }
  return score
}

export function isBust(cards: Card[]): boolean {
  return handScore(cards) > TARGET_SCORE
}

/** The higher non-bust hand wins; two bust hands or equal hands draw. */
export function compareHands(first: Card[], second: Card[]): -1 | 0 | 1 {
  const firstScore = isBust(first) ? -1 : handScore(first)
  const secondScore = isBust(second) ? -1 : handScore(second)
  return firstScore > secondScore ? 1 : firstScore < secondScore ? -1 : 0
}
