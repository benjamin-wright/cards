import type { Card, Rank } from '../cards'

export const HAND_SIZE = 7
export const TARGET_SCORE = 100

/** Eights are wild: they can be played on anything and change the active suit. */
export const WILD_RANK: Rank = '8'
/** Jacks skip the next player's turn. */
export const SKIP_RANK: Rank = 'J'
/** Tens are transparent: playable on anything, but they don't change what the
 * following card has to match — that's still whatever was under the ten. */
export const TRANSPARENT_RANK: Rank = '10'
/** Twos force the next player to pick up, and the pick-up stacks. */
export const PICKUP_RANK: Rank = '2'
export const PICKUP_AMOUNT = 2

/** Points scored against whoever is left holding this card at the end of a hand. */
export function cardPoints(card: Card): number {
  if (card.rank === '8') return 50
  if (card.rank === 'A') return 1
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10
  return Number(card.rank)
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((total, card) => total + cardPoints(card), 0)
}
