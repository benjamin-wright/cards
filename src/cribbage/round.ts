import type { Card, Rng } from '../cards'
import { cardKey, createDeck, isCard, isCardList, shuffle } from '../cards'
import type { Player } from '../players'
import { cardValue, scoreHand, scoreHeels, scorePegging } from './scoring'

export const TARGET_SCORE = 121

export type HandState = {
  playerId: string
  name: string
  dealt: Card[]
  hand: Card[]
  discards: Card[]
  played: Card[]
}

export type PeggingPlay = {
  playerId: string
  card: Card
}

export type Phase = 'discard' | 'cut' | 'play' | 'show' | 'summary'
export type ShowStep = 'nonDealer' | 'dealer' | 'crib' | 'complete'

export type Round = {
  dealerId: string
  nonDealerId: string
  hands: [HandState, HandState]
  crib: Card[]
  starter: Card | null
  deck: Card[]
  phase: Phase
  showStep: ShowStep
  playSequence: PeggingPlay[]
  currentCount: number
  lastPlayerId: string | null
  turn: string
  scores: Record<string, number>
  lastLog: string | null
  winnerId: string | null
}

export function createRound(
  players: Player[],
  dealerId?: string,
  scores?: Record<string, number>,
  rng: Rng = Math.random,
): Round {
  const deck = shuffle(createDeck(), rng)
  const dId = dealerId ?? players[0].id
  const nonDId = players.find(p => p.id !== dId)?.id ?? players[1].id

  const p1 = players.find(p => p.id === dId)!
  const p2 = players.find(p => p.id === nonDId)!

  const dealt1 = deck.slice(0, 6)
  const dealt2 = deck.slice(6, 12)
  const remainingDeck = deck.slice(12)

  const hand1: HandState = {
    playerId: p1.id,
    name: p1.name || 'Player 1',
    dealt: dealt1,
    hand: [...dealt1],
    discards: [],
    played: [],
  }

  const hand2: HandState = {
    playerId: p2.id,
    name: p2.name || 'Player 2',
    dealt: dealt2,
    hand: [...dealt2],
    discards: [],
    played: [],
  }

  // Position hands so [0] is left/p1, [1] is right/p2
  const handList: [HandState, HandState] =
    p1.id === players[0].id ? [hand1, hand2] : [hand2, hand1]

  const initScores: Record<string, number> =
    scores ?? Object.fromEntries(players.map(p => [p.id, 0]))

  return {
    dealerId: dId,
    nonDealerId: nonDId,
    hands: handList,
    crib: [],
    starter: null,
    deck: remainingDeck,
    phase: 'discard',
    showStep: 'nonDealer',
    playSequence: [],
    currentCount: 0,
    lastPlayerId: null,
    turn: nonDId,
    scores: initScores,
    lastLog: 'Pick 2 cards to discard to the crib.',
    winnerId: null,
  }
}

export function isHandState(value: unknown): value is HandState {
  const hand = value as Partial<HandState>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof hand.playerId === 'string' &&
    typeof hand.name === 'string' &&
    isCardList(hand.dealt) &&
    isCardList(hand.hand) &&
    isCardList(hand.discards) &&
    isCardList(hand.played)
  )
}

export function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof round.dealerId === 'string' &&
    typeof round.nonDealerId === 'string' &&
    Array.isArray(round.hands) &&
    round.hands.length === 2 &&
    round.hands.every(isHandState) &&
    isCardList(round.crib) &&
    (round.starter === null || isCard(round.starter)) &&
    isCardList(round.deck) &&
    ['discard', 'cut', 'play', 'show', 'summary'].includes(round.phase!) &&
    ['nonDealer', 'dealer', 'crib', 'complete'].includes(round.showStep!) &&
    typeof round.currentCount === 'number' &&
    typeof round.turn === 'string' &&
    typeof round.scores === 'object' &&
    round.scores !== null
  )
}

export function discardToCrib(round: Round, playerId: string, selectedCards: Card[]): Round {
  if (round.phase !== 'discard') return round
  if (selectedCards.length !== 2) return round

  const handIndex = round.hands.findIndex(h => h.playerId === playerId)
  if (handIndex === -1) return round

  const handState = round.hands[handIndex]
  if (handState.discards.length > 0) return round // already discarded

  const selectedKeys = new Set(selectedCards.map(cardKey))
  const validDiscards = handState.dealt.filter(c => selectedKeys.has(cardKey(c)))
  if (validDiscards.length !== 2) return round

  const remainingHand = handState.dealt.filter(c => !selectedKeys.has(cardKey(c)))

  const updatedHand: HandState = {
    ...handState,
    discards: validDiscards,
    hand: remainingHand,
  }

  const nextHands: [HandState, HandState] = [...round.hands]
  nextHands[handIndex] = updatedHand

  const bothDiscarded = nextHands.every(h => h.discards.length === 2)
  if (!bothDiscarded) {
    return {
      ...round,
      hands: nextHands,
      lastLog: `${handState.name} discarded to crib. Waiting for opponent.`,
    }
  }

  // Both discarded -> create crib and cut starter card
  const crib = nextHands.flatMap(h => h.discards)
  const starter = round.deck[0]
  const remainingDeck = round.deck.slice(1)

  const heels = scoreHeels(starter)
  const nextScores = { ...round.scores }
  let winnerId = round.winnerId
  let phase: Phase = 'play'

  let log = `Starter card is ${starter.rank} of ${starter.suit}.`
  if (heels > 0) {
    nextScores[round.dealerId] = (nextScores[round.dealerId] ?? 0) + heels
    log += ` Dealer scored 2 for His Heels!`
    if (nextScores[round.dealerId] >= TARGET_SCORE) {
      winnerId = round.dealerId
      phase = 'summary'
    }
  }

  return {
    ...round,
    hands: nextHands,
    crib,
    starter,
    deck: remainingDeck,
    phase,
    turn: round.nonDealerId,
    scores: nextScores,
    winnerId,
    lastLog: log,
  }
}

export function unplayedCards(hand: HandState): Card[] {
  const playedKeys = new Set(hand.played.map(cardKey))
  return hand.hand.filter(c => !playedKeys.has(cardKey(c)))
}

export function canPlayAnyCard(round: Round, playerId: string): boolean {
  const hand = round.hands.find(h => h.playerId === playerId)
  if (!hand) return false
  const remaining = unplayedCards(hand)
  return remaining.some(c => cardValue(c) <= 31 - round.currentCount)
}

export function playCard(round: Round, playerId: string, card: Card): Round {
  if (round.phase !== 'play') return round
  if (round.turn !== playerId) return round

  const handIndex = round.hands.findIndex(h => h.playerId === playerId)
  if (handIndex === -1) return round
  const hand = round.hands[handIndex]

  const remaining = unplayedCards(hand)
  const isAvailable = remaining.some(c => cardKey(c) === cardKey(card))
  if (!isAvailable) return round

  const val = cardValue(card)
  if (round.currentCount + val > 31) return round

  const nextCount = round.currentCount + val
  const nextSeq = [...round.playSequence, { playerId, card }]
  const updatedHand: HandState = {
    ...hand,
    played: [...hand.played, card],
  }

  const nextHands: [HandState, HandState] = [...round.hands]
  nextHands[handIndex] = updatedHand

  const pegging = scorePegging(
    nextSeq.map(p => p.card),
    nextCount,
  )

  const nextScores = { ...round.scores }
  if (pegging.points > 0) {
    nextScores[playerId] = (nextScores[playerId] ?? 0) + pegging.points
  }

  if ((nextScores[playerId] ?? 0) >= TARGET_SCORE) {
    return {
      ...round,
      hands: nextHands,
      scores: nextScores,
      winnerId: playerId,
      phase: 'summary',
      lastLog: `${hand.name} reached ${TARGET_SCORE} points and won!`,
    }
  }

  const opponentId = round.hands.find(h => h.playerId !== playerId)!.playerId

  // Construct temp round to check availability
  const tempRound: Round = {
    ...round,
    hands: nextHands,
    currentCount: nextCount,
    playSequence: nextSeq,
    scores: nextScores,
  }

  let desc = `${hand.name} played ${card.rank}`
  if (pegging.reasons.length > 0) {
    desc += ` (${pegging.reasons.join(', ')})`
  }

  if (nextCount === 31) {
    // 31 reset
    const oppCanPlay = canPlayAnyCard({ ...tempRound, currentCount: 0 }, opponentId)
    const selfCanPlay = canPlayAnyCard({ ...tempRound, currentCount: 0 }, playerId)

    let nextTurn: string
    let nextPhase: Phase = 'play'
    if (oppCanPlay) {
      nextTurn = opponentId
    } else if (selfCanPlay) {
      nextTurn = playerId
    } else {
      nextPhase = 'show'
      nextTurn = round.nonDealerId
    }

    return {
      ...tempRound,
      currentCount: 0,
      playSequence: [],
      lastPlayerId: null,
      turn: nextTurn,
      phase: nextPhase,
      showStep: 'nonDealer',
      lastLog: `${desc}. 31 for 2! Count reset.`,
    }
  }

  // nextCount < 31
  const oppCanPlay = canPlayAnyCard(tempRound, opponentId)
  if (oppCanPlay) {
    return {
      ...tempRound,
      lastPlayerId: playerId,
      turn: opponentId,
      lastLog: desc,
    }
  }

  const selfCanPlay = canPlayAnyCard(tempRound, playerId)
  if (selfCanPlay) {
    return {
      ...tempRound,
      lastPlayerId: playerId,
      turn: playerId,
      lastLog: `${desc}. Opponent cannot play. ${hand.name} turn continues.`,
    }
  }

  // Neither can play under 31 -> Go (1 pt to last player)
  nextScores[playerId] = (nextScores[playerId] ?? 0) + 1
  if (nextScores[playerId] >= TARGET_SCORE) {
    return {
      ...tempRound,
      scores: nextScores,
      winnerId: playerId,
      phase: 'summary',
      lastLog: `${desc}. Go for 1! ${hand.name} reached ${TARGET_SCORE} points and won!`,
    }
  }

  const oppCanPlayReset = canPlayAnyCard({ ...tempRound, currentCount: 0 }, opponentId)
  const selfCanPlayReset = canPlayAnyCard({ ...tempRound, currentCount: 0 }, playerId)

  let nextTurn: string
  let nextPhase: Phase = 'play'
  if (oppCanPlayReset) {
    nextTurn = opponentId
  } else if (selfCanPlayReset) {
    nextTurn = playerId
  } else {
    nextPhase = 'show'
    nextTurn = round.nonDealerId
  }

  return {
    ...tempRound,
    scores: nextScores,
    currentCount: 0,
    playSequence: [],
    lastPlayerId: null,
    turn: nextTurn,
    phase: nextPhase,
    showStep: 'nonDealer',
    lastLog: `${desc}. Go for 1! Count reset.`,
  }
}

export function advanceShow(round: Round): Round {
  if (round.phase !== 'show' || round.starter === null) return round

  const nonDealerHand = round.hands.find(h => h.playerId === round.nonDealerId)!
  const dealerHand = round.hands.find(h => h.playerId === round.dealerId)!
  const nextScores = { ...round.scores }

  if (round.showStep === 'nonDealer') {
    const scored = scoreHand(nonDealerHand.hand, round.starter, false)
    nextScores[round.nonDealerId] = (nextScores[round.nonDealerId] ?? 0) + scored.totalPoints

    if (nextScores[round.nonDealerId] >= TARGET_SCORE) {
      return {
        ...round,
        scores: nextScores,
        winnerId: round.nonDealerId,
        phase: 'summary',
        showStep: 'complete',
        lastLog: `${nonDealerHand.name}'s hand scores ${scored.totalPoints} pts and wins the game!`,
      }
    }

    return {
      ...round,
      scores: nextScores,
      showStep: 'dealer',
      lastLog: `${nonDealerHand.name}'s hand scored ${scored.totalPoints} pts.`,
    }
  }

  if (round.showStep === 'dealer') {
    const scored = scoreHand(dealerHand.hand, round.starter, false)
    nextScores[round.dealerId] = (nextScores[round.dealerId] ?? 0) + scored.totalPoints

    if (nextScores[round.dealerId] >= TARGET_SCORE) {
      return {
        ...round,
        scores: nextScores,
        winnerId: round.dealerId,
        phase: 'summary',
        showStep: 'complete',
        lastLog: `${dealerHand.name}'s hand scores ${scored.totalPoints} pts and wins the game!`,
      }
    }

    return {
      ...round,
      scores: nextScores,
      showStep: 'crib',
      lastLog: `${dealerHand.name}'s hand scored ${scored.totalPoints} pts.`,
    }
  }

  if (round.showStep === 'crib') {
    const scored = scoreHand(round.crib, round.starter, true)
    nextScores[round.dealerId] = (nextScores[round.dealerId] ?? 0) + scored.totalPoints

    if (nextScores[round.dealerId] >= TARGET_SCORE) {
      return {
        ...round,
        scores: nextScores,
        winnerId: round.dealerId,
        phase: 'summary',
        showStep: 'complete',
        lastLog: `${dealerHand.name}'s crib scores ${scored.totalPoints} pts and wins the game!`,
      }
    }

    return {
      ...round,
      scores: nextScores,
      phase: 'summary',
      showStep: 'complete',
      lastLog: `${dealerHand.name}'s crib scored ${scored.totalPoints} pts. Hand complete!`,
    }
  }

  return round
}
