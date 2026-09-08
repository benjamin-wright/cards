import type { Card, Rank } from '../cards'

export type { Card, Rank, Rng } from '../cards'
export { RANKS, SUITS, createDeck, shuffle } from '../cards'

export type Outcome = 'win' | 'lose' | 'push'

export const ANTE = 1
export const RAISE_OPTIONS = [1, 10, 100]
export const HOUSE_STICK_SCORE = 15
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

export function houseShouldTwist(cards: Card[]): boolean {
  return handScore(cards) < HOUSE_STICK_SCORE
}

/** Plays out the house hand according to the fixed house rules. */
export function playHouse(cards: Card[], deck: Card[]): { cards: Card[]; deck: Card[] } {
  const hand = [...cards]
  const remaining = [...deck]
  while (houseShouldTwist(hand) && remaining.length > 0) {
    hand.push(remaining.shift()!)
  }
  return { cards: hand, deck: remaining }
}

export function settle(playerCards: Card[], houseCards: Card[]): Outcome {
  if (isBust(playerCards)) return 'lose'
  if (isBust(houseCards)) return 'win'

  const player = handScore(playerCards)
  const house = handScore(houseCards)
  if (player > house) return 'win'
  if (player < house) return 'lose'
  return 'push'
}

/** Change in cash for a settled hand, given the total staked. */
export function payout(outcome: Outcome, bet: number): number {
  if (outcome === 'win') return bet
  if (outcome === 'lose') return -bet
  return 0
}

/** The raise amounts a player can afford on top of their current bet. */
export function affordableRaises(cash: number, bet: number): number[] {
  return RAISE_OPTIONS.filter(option => bet + option <= cash)
}
