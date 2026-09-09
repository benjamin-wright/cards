import { useState, type ReactNode } from 'react'
import type { Card } from '../cards'
import { cardKey } from '../cards'
import type { Player } from '../players'
import { useDeviceView } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import CribbageBoard from './CribbageBoard'
import {
  TARGET_SCORE,
  advanceShow,
  canPlayAnyCard,
  createRound,
  discardToCrib,
  isRound,
  playCard,
  unplayedCards,
  type HandState,
  type Round,
} from './round'
import { cardValue, scoreHand } from './scoring'

type CribbageProps = {
  players: Player[]
  onExit: () => void
}

type CribbageState = {
  round: Round | null
  lastStarterId: string | null
}

function isCribbageState(value: unknown): value is CribbageState {
  const state = value as Partial<CribbageState>
  return (
    typeof value === 'object' &&
    value !== null &&
    (state.round === null || isRound(state.round)) &&
    (state.lastStarterId === null || typeof state.lastStarterId === 'string')
  )
}

function GameBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="game-bar">
      <span className="game-bar-title">Cribbage</span>
      <button type="button" className="btn-ghost" onClick={onExit}>
        Exit
      </button>
    </div>
  )
}

function HiddenHand({ count }: { count: number }) {
  return (
    <span className="hand">
      {Array.from({ length: count }, (_, index) => (
        <CardFace key={index} faceDown />
      ))}
    </span>
  )
}

function HandCards({
  cards,
  selectedKeys,
  onSelect,
  disabledCardKeys,
  interactive,
}: {
  cards: Card[]
  selectedKeys: Set<string>
  onSelect: ((card: Card) => void) | null
  disabledCardKeys?: Set<string>
  interactive: boolean
}) {
  if (cards.length === 0) return null

  return (
    <span className="hand">
      {cards.map(card => {
        const key = cardKey(card)
        const isSelected = selectedKeys.has(key)
        const isDisabled = !interactive || (disabledCardKeys !== undefined && disabledCardKeys.has(key))

        return (
          <CardFace
            key={key}
            card={card}
            selected={isSelected}
            disabled={isDisabled}
            onClick={onSelect === null || isDisabled ? undefined : () => onSelect(card)}
          />
        )
      })}
    </span>
  )
}

function SeatPanel({
  hand,
  round,
  visible,
  canToggle,
  onToggle,
  selectedCards,
  onSelectCard,
  onConfirmDiscard,
  onPlayCard,
  onPassGo,
  onAdvanceShow,
  onDealNextHand,
  onNewGame,
}: {
  hand: HandState
  round: Round
  visible: boolean
  canToggle: boolean
  onToggle: () => void
  selectedCards: Card[]
  onSelectCard: (card: Card) => void
  onConfirmDiscard: () => void
  onPlayCard: (card: Card) => void
  onPassGo: () => void
  onAdvanceShow: () => void
  onDealNextHand: () => void
  onNewGame: () => void
}) {
  const isDealer = round.dealerId === hand.playerId
  const isTurn = round.turn === hand.playerId
  const isDiscarding = round.phase === 'discard' && hand.discards.length === 0
  const isPlaying = round.phase === 'play' && isTurn

  const remaining = unplayedCards(hand)
  const canPlayAny = isPlaying && canPlayAnyCard(round, hand.playerId)

  const disabledCardKeys = new Set<string>()
  if (isPlaying) {
    for (const c of remaining) {
      if (cardValue(c) > 31 - round.currentCount) {
        disabledCardKeys.add(cardKey(c))
      }
    }
  }

  const selectedKeySet = new Set(selectedCards.map(cardKey))

  let statusText = isDealer ? 'Dealer' : 'Non-Dealer'
  if (round.winnerId === hand.playerId) {
    statusText = 'Winner!'
  } else if (round.phase === 'play') {
    statusText = isTurn ? (canPlayAny ? 'Your turn to play' : 'Must call Go') : 'Waiting'
  } else if (round.phase === 'discard') {
    statusText = hand.discards.length === 0 ? 'Pick 2 discards' : 'Ready'
  }

  const scoredHand =
    round.phase === 'show' || round.phase === 'summary'
      ? round.starter
        ? scoreHand(hand.hand, round.starter, false)
        : null
      : null

  return (
    <section className={`seat-panel${isPlaying ? ' seat-panel--active' : ''}`}>
      <header className="seat-panel-header">
        <h2>
          {hand.name}
          {isDealer && <span className="dealer-tag">(Dealer)</span>}
        </h2>
        <span className="seat-panel-status">{statusText}</span>
      </header>

      {visible ? (
        <HandCards
          cards={round.phase === 'discard' ? hand.hand : remaining}
          selectedKeys={selectedKeySet}
          onSelect={card => {
            if (isDiscarding) {
              onSelectCard(card)
            } else if (isPlaying && !disabledCardKeys.has(cardKey(card))) {
              onPlayCard(card)
            }
          }}
          disabledCardKeys={disabledCardKeys}
          interactive={isDiscarding || isPlaying}
        />
      ) : (
        <HiddenHand count={round.phase === 'discard' ? hand.hand.length : remaining.length} />
      )}

      <div className="panel-actions">
        {canToggle && round.phase !== 'summary' && (
          <button type="button" className="btn-secondary" onClick={onToggle}>
            {visible ? 'Hide cards' : 'Show cards'}
          </button>
        )}

        {isDiscarding && visible && (
          <button
            type="button"
            className="btn-primary"
            disabled={selectedCards.length !== 2}
            onClick={onConfirmDiscard}
          >
            {selectedCards.length === 2 ? 'Discard 2 to Crib' : 'Pick 2 cards'}
          </button>
        )}

        {isPlaying && visible && !canPlayAny && (
          <button type="button" className="btn-primary" onClick={onPassGo}>
            Go (Pass)
          </button>
        )}

        {round.phase === 'show' && (
          <button type="button" className="btn-primary" onClick={onAdvanceShow}>
            {round.showStep === 'nonDealer'
              ? `Score ${round.hands.find(h => h.playerId === round.nonDealerId)?.name}'s Hand`
              : round.showStep === 'dealer'
                ? `Score ${round.hands.find(h => h.playerId === round.dealerId)?.name}'s Hand`
                : 'Score Crib'}
          </button>
        )}

        {round.phase === 'summary' && (
          <button
            type="button"
            className="btn-primary"
            onClick={round.winnerId !== null ? onNewGame : onDealNextHand}
          >
            {round.winnerId !== null ? 'New Game' : 'Next Hand'}
          </button>
        )}
      </div>

      {scoredHand !== null && (round.phase === 'show' || round.phase === 'summary') && (
        <div className="hint">
          Hand details: {scoredHand.details.length > 0 ? scoredHand.details.map(d => d.description).join(', ') : 'No points'} ({scoredHand.totalPoints} pts)
        </div>
      )}
    </section>
  )
}

function Screen({ onExit, children }: { onExit: () => void; children: ReactNode }) {
  return (
    <main className="view-rummy">
      <GameBar onExit={onExit} />
      {children}
    </main>
  )
}

export default function Cribbage({ players, onExit }: CribbageProps) {
  const { tilt, tiltAccess, portrait, locked, canLock, enable } = useDeviceView()
  const [state, setState] = usePersistentState<CribbageState>(
    STORAGE_KEYS.cribbage,
    () => ({
      round: createRound(players, players[0]?.id),
      lastStarterId: players[0]?.id ?? null,
    }),
    isCribbageState,
  )

  const [revealed, setRevealed] = useState<string[]>([])
  const [selectedCards, setSelectedCards] = useState<Card[]>([])

  const { round } = state

  if (round === null) {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>No hand in progress</h1>
        </header>
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </Screen>
    )
  }

  const setRound = (next: Round) => setState(current => ({ ...current, round: next }))

  const handleSelectCard = (card: Card) => {
    setSelectedCards(current => {
      const exists = current.some(c => cardKey(c) === cardKey(card))
      if (exists) {
        return current.filter(c => cardKey(c) !== cardKey(card))
      }
      if (current.length >= 2) {
        return [current[1], card]
      }
      return [...current, card]
    })
  }

  const handleConfirmDiscard = (playerId: string) => {
    if (selectedCards.length !== 2) return
    const next = discardToCrib(round, playerId, selectedCards)
    setSelectedCards([])
    setRound(next)
  }

  const handlePlayCard = (playerId: string, card: Card) => {
    const next = playCard(round, playerId, card)
    setSelectedCards([])
    setRound(next)
  }

  const handleAdvanceShow = () => {
    const next = advanceShow(round)
    setRound(next)
  }

  const handleDealNextHand = () => {
    setSelectedCards([])
    setRevealed([])
    const nextDealerId = round.nonDealerId
    setState(current => ({
      round: createRound(players, nextDealerId, current.round?.scores),
      lastStarterId: nextDealerId,
    }))
  }

  const handleNewGame = () => {
    setSelectedCards([])
    setRevealed([])
    setState({
      round: createRound(players, players[0]?.id),
      lastStarterId: players[0]?.id ?? null,
    })
  }

  const [left, right] = round.hands
  const tilted = tiltAccess === 'granted'
  const facing = tilt === 'left' ? left : tilt === 'right' ? right : null

  const isVisible = (hand: HandState) => {
    if (round.phase === 'show' || round.phase === 'summary') return true
    if (tilted) return facing?.playerId === hand.playerId
    return revealed.includes(hand.playerId)
  }

  const toggleVisible = (hand: HandState) => {
    setSelectedCards([])
    setRevealed(current =>
      current.includes(hand.playerId)
        ? current.filter(id => id !== hand.playerId)
        : [...current, hand.playerId],
    )
  }

  const panelFor = (hand: HandState) => (
    <SeatPanel
      hand={hand}
      round={round}
      visible={isVisible(hand)}
      canToggle={!tilted}
      onToggle={() => toggleVisible(hand)}
      selectedCards={selectedCards}
      onSelectCard={handleSelectCard}
      onConfirmDiscard={() => handleConfirmDiscard(hand.playerId)}
      onPlayCard={card => handlePlayCard(hand.playerId, card)}
      onPassGo={() => {}}
      onAdvanceShow={handleAdvanceShow}
      onDealNextHand={handleDealNextHand}
      onNewGame={handleNewGame}
    />
  )

  const setupNeeded = tiltAccess === 'prompt' || (canLock && !locked)

  return (
    <main className="view-cribbage view-cribbage--table">
      <div className="cribbage-table">
        {/* Dynamic Cribbage Board on the left */}
        <div className="cribbage-board-container">
          <CribbageBoard
            player1Name={left.name}
            player2Name={right.name}
            player1Score={round.scores[left.playerId] ?? 0}
            player2Score={round.scores[right.playerId] ?? 0}
            player1PrevScore={round.previousScores?.[left.playerId] ?? 0}
            player2PrevScore={round.previousScores?.[right.playerId] ?? 0}
            targetScore={TARGET_SCORE}
          />
        </div>

        {/* Player seats and controls on the right */}
        <div className="cribbage-right-side">
          <div className="cribbage-top-bar">
            <div className="piles">
              <div className="pile">
                <span className="pile-label">Starter</span>
                {round.starter === null ? (
                  <CardFace faceDown />
                ) : (
                  <CardFace card={round.starter} />
                )}
              </div>

              {/* Graphical representation of the last card played */}
              <div className="pile pile--last-played">
                <span className="pile-label">Last Played</span>
                {round.lastPlayedCard ? (
                  <CardFace card={round.lastPlayedCard} highlighted />
                ) : (
                  <span className="hand-card hand-card--empty" aria-label="No card played yet" />
                )}
              </div>

              <div className="pile">
                <span className="pile-label">Crib</span>
                {round.phase === 'show' || round.phase === 'summary' ? (
                  <span className="hand">
                    {round.crib.map((card, idx) => (
                      <CardFace key={`${cardKey(card)}-${idx}`} card={card} />
                    ))}
                  </span>
                ) : (
                  <span className="pile-label">({round.crib.length} cards)</span>
                )}
              </div>

              {round.phase === 'play' && (
                <div className="pile">
                  <span className="pile-label">Count: {round.currentCount} / 31</span>
                </div>
              )}
            </div>

            <div className="cribbage-controls">
              {setupNeeded ? (
                <button type="button" className="btn-secondary" onClick={enable}>
                  Tilt setup
                </button>
              ) : (
                !portrait && <span className="pile-label">Turn upright</span>
              )}

              <button type="button" className="btn-ghost" onClick={onExit}>
                Exit
              </button>
            </div>
          </div>

          <div className="cribbage-seats">
            <RotatedSeat degrees={90}>{panelFor(left)}</RotatedSeat>
            <RotatedSeat degrees={-90}>{panelFor(right)}</RotatedSeat>
          </div>
        </div>
      </div>
    </main>
  )
}
