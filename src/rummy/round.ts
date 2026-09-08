import { createDeck, isCardList, shuffle, type Card, type Rng } from '../cards'
import type { Player } from '../players'
import { cardKey } from '../cards'
import {
  GIN_BONUS,
  HAND_SIZE,
  UNDERCUT_BONUS,
  bestLayout,
  canKnock,
  handValue,
  layOff,
  type Meld,
} from './melds'

/** Draw a card, then discard one. The round ends on a knock or an empty stock. */
export type Phase = 'draw' | 'discard' | 'summary'

const PHASES: Phase[] = ['draw', 'discard', 'summary']

export type Hand = {
  playerId: string
  name: string
  cards: Card[]
}

export type ResultKind = 'knock' | 'gin' | 'undercut' | 'draw'

export type ScoredHand = {
  playerId: string
  name: string
  melds: Meld[]
  deadwood: Card[]
  deadwoodValue: number
}

export type RoundResult = {
  kind: ResultKind
  /** Null when the stock ran out and nobody scored. */
  winnerId: string | null
  knockerId: string | null
  points: number
  hands: ScoredHand[]
}

export type Round = {
  stock: Card[]
  /** Discard pile, most recently discarded card last. */
  discard: Card[]
  hands: Hand[]
  turn: string
  phase: Phase
  /** The card picked up this turn, highlighted in the hand until it's played. */
  drawn: Card | null
  /** A card taken from the discard pile can't be thrown straight back. */
  blockedDiscard: Card | null
  result: RoundResult | null
}

/** With two cards left in the stock the hand is abandoned as a draw. */
export const STOCK_FLOOR = 2

export const TARGET_SCORE = 100

function isHand(value: unknown): value is Hand {
  const hand = value as Partial<Hand>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof hand.playerId === 'string' &&
    typeof hand.name === 'string' &&
    isCardList(hand.cards)
  )
}

/** Guards a round restored from storage, so bad data starts a fresh hand. */
export function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>
  return (
    typeof value === 'object' &&
    value !== null &&
    isCardList(round.stock) &&
    isCardList(round.discard) &&
    Array.isArray(round.hands) &&
    round.hands.length === 2 &&
    round.hands.every(isHand) &&
    typeof round.turn === 'string' &&
    round.hands.some(hand => hand.playerId === round.turn) &&
    PHASES.includes(round.phase!) &&
    (round.drawn === null || isCardList([round.drawn])) &&
    (round.blockedDiscard === null || isCardList([round.blockedDiscard])) &&
    (round.result === null || typeof round.result === 'object')
  )
}

/**
 * Deals ten cards each, turns one card face up to start the discard pile and
 * leaves the rest as the stock. `firstPlayerId` takes the opening turn.
 */
export function createRound(players: Player[], firstPlayerId?: string, rng: Rng = Math.random): Round {
  const deck = shuffle(createDeck(), rng)

  const hands: Hand[] = players.map(player => ({
    playerId: player.id,
    name: player.name,
    cards: [],
  }))

  for (let deal = 0; deal < HAND_SIZE; deal += 1) {
    for (const hand of hands) {
      hand.cards.push(deck.shift()!)
    }
  }

  const upcard = deck.shift()!
  const turn = hands.find(hand => hand.playerId === firstPlayerId)?.playerId ?? hands[0].playerId

  return {
    stock: deck,
    discard: [upcard],
    hands,
    turn,
    phase: 'draw',
    drawn: null,
    blockedDiscard: null,
    result: null,
  }
}

export function handFor(round: Round, playerId: string): Hand | undefined {
  return round.hands.find(hand => hand.playerId === playerId)
}

export function opponentOf(round: Round, playerId: string): Hand {
  return round.hands.find(hand => hand.playerId !== playerId) ?? round.hands[0]
}

export function topOfDiscard(round: Round): Card | null {
  return round.discard.length === 0 ? null : round.discard[round.discard.length - 1]
}

function withHand(round: Round, playerId: string, cards: Card[]): Round {
  return {
    ...round,
    hands: round.hands.map(hand => (hand.playerId === playerId ? { ...hand, cards } : hand)),
  }
}

function canAct(round: Round, playerId: string, phase: Phase): boolean {
  return round.phase === phase && round.turn === playerId && round.result === null
}

/** Takes the top of the stock into the player's hand. */
export function drawFromStock(round: Round, playerId: string): Round {
  const hand = handFor(round, playerId)
  if (!canAct(round, playerId, 'draw') || hand === undefined || round.stock.length === 0) {
    return round
  }

  const [card, ...stock] = round.stock
  return {
    ...withHand({ ...round, stock }, playerId, [...hand.cards, card]),
    phase: 'discard',
    drawn: card,
    blockedDiscard: null,
  }
}

/** Takes the face-up discard, which then can't be thrown straight back. */
export function drawFromDiscard(round: Round, playerId: string): Round {
  const hand = handFor(round, playerId)
  const card = topOfDiscard(round)
  if (!canAct(round, playerId, 'draw') || hand === undefined || card === null) {
    return round
  }

  const discard = round.discard.slice(0, -1)
  return {
    ...withHand({ ...round, discard }, playerId, [...hand.cards, card]),
    phase: 'discard',
    drawn: card,
    blockedDiscard: card,
  }
}

export function canDiscard(round: Round, playerId: string, card: Card): boolean {
  const hand = handFor(round, playerId)
  return (
    canAct(round, playerId, 'discard') &&
    hand !== undefined &&
    hand.cards.some(entry => cardKey(entry) === cardKey(card)) &&
    (round.blockedDiscard === null || cardKey(round.blockedDiscard) !== cardKey(card))
  )
}

function removeCard(cards: Card[], card: Card): Card[] {
  const index = cards.findIndex(entry => cardKey(entry) === cardKey(card))
  return index === -1 ? cards : [...cards.slice(0, index), ...cards.slice(index + 1)]
}

/** Discards a card and passes the turn, or ends the hand if the stock runs dry. */
export function discard(round: Round, playerId: string, card: Card): Round {
  const hand = handFor(round, playerId)
  if (!canDiscard(round, playerId, card) || hand === undefined) {
    return round
  }

  const next: Round = {
    ...withHand(round, playerId, removeCard(hand.cards, card)),
    discard: [...round.discard, card],
    turn: opponentOf(round, playerId).playerId,
    phase: 'draw',
    drawn: null,
    blockedDiscard: null,
  }

  if (next.stock.length <= STOCK_FLOOR) {
    return abandonRound(next)
  }

  return next
}

export function canKnockWith(round: Round, playerId: string, card: Card): boolean {
  const hand = handFor(round, playerId)
  if (!canDiscard(round, playerId, card) || hand === undefined) return false
  return canKnock(removeCard(hand.cards, card))
}

function scoreHand(hand: Hand): ScoredHand {
  const layout = bestLayout(hand.cards)
  return {
    playerId: hand.playerId,
    name: hand.name,
    melds: layout.melds,
    deadwood: layout.deadwood,
    deadwoodValue: layout.deadwoodValue,
  }
}

/** Nobody scores when the stock runs out — both hands are simply shown. */
function abandonRound(round: Round): Round {
  return {
    ...round,
    phase: 'summary',
    turn: round.turn,
    result: {
      kind: 'draw',
      winnerId: null,
      knockerId: null,
      points: 0,
      hands: round.hands.map(scoreHand),
    },
  }
}

/**
 * Discards a card and knocks. Gin scores a bonus on the defender's whole hand,
 * otherwise the defender lays their deadwood off onto the knocker's melds and
 * an equal or lower count undercuts the knock.
 */
export function knock(round: Round, playerId: string, card: Card): Round {
  const hand = handFor(round, playerId)
  if (!canKnockWith(round, playerId, card) || hand === undefined) {
    return round
  }

  const knocked: Round = {
    ...withHand(round, playerId, removeCard(hand.cards, card)),
    discard: [...round.discard, card],
    phase: 'summary',
    drawn: null,
    blockedDiscard: null,
  }

  const knocker = scoreHand(handFor(knocked, playerId)!)
  const defenderHand = opponentOf(knocked, playerId)
  let defender = scoreHand(defenderHand)

  const gin = knocker.deadwoodValue === 0

  if (!gin) {
    const laid = layOff(defender.deadwood, knocker.melds)
    // The knocker's melds are shown with the laid-off cards attached.
    knocker.melds = laid.melds
    defender = { ...defender, deadwood: laid.deadwood, deadwoodValue: handValue(laid.deadwood) }
  }
  const undercut = !gin && defender.deadwoodValue <= knocker.deadwoodValue

  const result: RoundResult = gin
    ? {
        kind: 'gin',
        winnerId: playerId,
        knockerId: playerId,
        points: defender.deadwoodValue + GIN_BONUS,
        hands: [knocker, defender],
      }
    : undercut
      ? {
          kind: 'undercut',
          winnerId: defender.playerId,
          knockerId: playerId,
          points: knocker.deadwoodValue - defender.deadwoodValue + UNDERCUT_BONUS,
          hands: [knocker, defender],
        }
      : {
          kind: 'knock',
          winnerId: playerId,
          knockerId: playerId,
          points: defender.deadwoodValue - knocker.deadwoodValue,
          hands: [knocker, defender],
        }

  return { ...knocked, result }
}
