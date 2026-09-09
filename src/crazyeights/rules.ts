import type { Card, Rank } from '../cards'

export const HAND_SIZE = 7
export const TARGET_SCORE = 100

/** Jacks are wild: they can be played on anything and change the active suit. */
export const WILD_RANK: Rank = 'J'
/** Eights skip the next player's turn. */
export const SKIP_RANK: Rank = '8'
/** Twos force the next player to pick up, and the pick-up stacks. */
export const PICKUP_RANK: Rank = '2'
export const PICKUP_AMOUNT = 2

/** Points scored against whoever is left holding this card at the end of a hand. */
export function cardPoints(card: Card): number {
  if (card.rank === SKIP_RANK) return 50
  if (card.rank === 'A') return 1
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10
  return Number(card.rank)
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}
