import { createDeck, isCardList, shuffle, cardKey, SUITS, type Card, type Rng, type Suit } from '../cards'
import type { Player } from '../players'
import { HAND_SIZE, PICKUP_AMOUNT, PICKUP_RANK, SKIP_RANK, WILD_RANK, handPoints } from './rules'

export type Hand = {
  playerId: string
  name: string
  cards: Card[]
}

export type RoundResult = {
  winnerId: string
  points: number
  hands: Hand[]
}

export type Round = {
  stock: Card[]
  /** Discard pile, most recently played card last. */
  discard: Card[]
  hands: Hand[]
  turn: string
  /** The suit that must be matched — the top card's suit, or the suit chosen after a jack. */
  activeSuit: Suit
  /** Cards the player to move must pick up, unless they can play a two to pass it on. */
  pendingPickup: number
  /** The card drawn this turn, if any, still waiting on a play-or-pass decision. */
  drawn: Card | null
  result: RoundResult | null
}

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
    SUITS.includes(round.activeSuit!) &&
    typeof round.pendingPickup === 'number' &&
    Number.isFinite(round.pendingPickup) &&
    (round.drawn === null || isCardList([round.drawn])) &&
    (round.result === null || typeof round.result === 'object')
  )
}

/**
 * Deals seven cards each and turns one card up to start the discard pile. The
 * starting upcard's rank has no special effect, even if it's a two, eight or
 * jack — only cards played during the hand trigger those. `firstPlayerId`
 * takes the opening turn.
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
    activeSuit: upcard.suit,
    pendingPickup: 0,
    drawn: null,
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

function removeCard(cards: Card[], card: Card): Card[] {
  const index = cards.findIndex(entry => cardKey(entry) === cardKey(card))
  return index === -1 ? cards : [...cards.slice(0, index), ...cards.slice(index + 1)]
}

/** Whether a card can land on the pile as it stands, ignoring whose turn it is. */
function matchesPile(round: Round, card: Card): boolean {
  if (round.pendingPickup > 0) return card.rank === PICKUP_RANK

  const top = topOfDiscard(round)
  return card.rank === WILD_RANK || card.suit === round.activeSuit || (top !== null && card.rank === top.rank)
}

export function canPlay(round: Round, playerId: string, card: Card): boolean {
  const hand = handFor(round, playerId)
  if (round.result !== null || round.turn !== playerId || hand === undefined) return false
  if (!hand.cards.some(entry => cardKey(entry) === cardKey(card))) return false
  // Once a card is drawn, that draw was the turn's action — only the drawn
  // card itself can still be played, not something else from the hand.
  if (round.drawn !== null && cardKey(round.drawn) !== cardKey(card)) return false
  return matchesPile(round, card)
}

/** Whether any card in hand could be played right now, drawn or not. */
export function canPlayAny(round: Round, playerId: string): boolean {
  const hand = handFor(round, playerId)
  if (hand === undefined) return false
  return hand.cards.some(card => canPlay(round, playerId, card))
}

/**
 * Plays a card, matching the active suit, the discard's rank, or as a wild
 * jack. Jacks require a `chosenSuit` to switch play to. Twos add to a pick-up
 * that stacks until someone can't (or won't) pass it on further, and eights
 * skip the other player's turn straight back to the one who played it.
 */
export function playCard(round: Round, playerId: string, card: Card, chosenSuit?: Suit): Round {
  const hand = handFor(round, playerId)
  if (!canPlay(round, playerId, card) || hand === undefined) return round
  if (card.rank === WILD_RANK && chosenSuit === undefined) return round

  const remaining = removeCard(hand.cards, card)
  const activeSuit = card.rank === WILD_RANK ? chosenSuit! : card.suit
  const pendingPickup = card.rank === PICKUP_RANK ? round.pendingPickup + PICKUP_AMOUNT : 0

  const played: Round = {
    ...withHand({ ...round, discard: [...round.discard, card] }, playerId, remaining),
    activeSuit,
    pendingPickup,
    drawn: null,
  }

  if (remaining.length === 0) {
    return {
      ...played,
      turn: playerId,
      result: {
        winnerId: playerId,
        points: handPoints(opponentOf(round, playerId).cards),
        hands: played.hands,
      },
    }
  }

  const skip = card.rank === SKIP_RANK
  return { ...played, turn: skip ? playerId : opponentOf(round, playerId).playerId }
}

/** Draws (and reshuffles the discard back into the stock) as many cards as are available. */
function takeCards(round: Round, count: number, rng: Rng): { cards: Card[]; stock: Card[]; discard: Card[] } {
  let stock = [...round.stock]
  let discard = [...round.discard]
  const cards: Card[] = []

  for (let taken = 0; taken < count; taken += 1) {
    if (stock.length === 0) {
      if (discard.length <= 1) break
      const top = discard[discard.length - 1]
      stock = shuffle(discard.slice(0, -1), rng)
      discard = [top]
    }
    cards.push(stock.shift()!)
  }

  return { cards, stock, discard }
}

export function canDraw(round: Round, playerId: string): boolean {
  return round.result === null && round.turn === playerId && round.drawn === null
}

/**
 * With a pick-up pending, this takes the whole stack at once and passes the
 * turn on. Otherwise it's a single card: playable, it joins the hand awaiting
 * a play-or-pass decision; unplayable, the turn simply moves on.
 */
export function draw(round: Round, playerId: string, rng: Rng = Math.random): Round {
  const hand = handFor(round, playerId)
  if (!canDraw(round, playerId) || hand === undefined) return round

  if (round.pendingPickup > 0) {
    const { cards, stock, discard } = takeCards(round, round.pendingPickup, rng)
    return {
      ...withHand({ ...round, stock, discard }, playerId, [...hand.cards, ...cards]),
      pendingPickup: 0,
      turn: opponentOf(round, playerId).playerId,
      drawn: null,
    }
  }

  const { cards, stock, discard } = takeCards(round, 1, rng)
  if (cards.length === 0) {
    return { ...round, turn: opponentOf(round, playerId).playerId, drawn: null }
  }

  const [card] = cards
  const updated = withHand({ ...round, stock, discard }, playerId, [...hand.cards, card])

  if (matchesPile(updated, card)) {
    return { ...updated, drawn: card }
  }

  return { ...updated, turn: opponentOf(round, playerId).playerId, drawn: null }
}

/** Keeps a drawn card without playing it, ending the turn. */
export function canPass(round: Round, playerId: string): boolean {
  return round.result === null && round.turn === playerId && round.drawn !== null
}

export function pass(round: Round, playerId: string): Round {
  if (!canPass(round, playerId)) return round
  return { ...round, turn: opponentOf(round, playerId).playerId, drawn: null }
}
