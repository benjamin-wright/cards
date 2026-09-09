import { useState, type ReactNode } from 'react'
import type { Card, Suit } from '../cards'
import { cardKey } from '../cards'
import { SUIT_SYMBOLS } from '../games'
import type { Player } from '../players'
import { useDeviceView } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import { TARGET_SCORE, WILD_RANK } from './rules'
import {
  canDraw,
  canPass,
  canPlay,
  canPlayAny,
  createRound,
  draw,
  isRound,
  opponentOf,
  pass,
  playCard,
  topOfDiscard,
  type Hand,
  type Round,
  type RoundResult,
} from './round'

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

type CrazyEightsProps = {
  players: Player[]
  onExit: () => void
}

type CrazyEightsState = {
  round: Round | null
  /** Running match score, keyed by player id. */
  scores: Record<string, number>
  /** The player who took the last opening turn, so deals alternate. */
  lastStarterId: string | null
}

function isScores(value: unknown): value is Record<string, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(entry => typeof entry === 'number' && Number.isFinite(entry))
  )
}

function isCrazyEightsState(value: unknown): value is CrazyEightsState {
  const state = value as Partial<CrazyEightsState>
  return (
    typeof value === 'object' &&
    value !== null &&
    (state.round === null || isRound(state.round)) &&
    isScores(state.scores) &&
    (state.lastStarterId === null || typeof state.lastStarterId === 'string')
  )
}

function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`
}

function GameBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="game-bar">
      <span className="game-bar-title">Crazy Eights</span>
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
  selected,
  onSelect,
  drawn,
  interactive,
}: {
  cards: Card[]
  selected: Card | null
  onSelect: ((card: Card) => void) | null
  drawn: Card | null
  interactive: boolean
}) {
  return (
    <span className="hand">
      {cards.map(card => (
        <CardFace
          key={cardKey(card)}
          card={card}
          selected={selected !== null && cardKey(selected) === cardKey(card)}
          highlighted={drawn !== null && cardKey(drawn) === cardKey(card)}
          onClick={onSelect === null ? undefined : () => onSelect(card)}
          disabled={!interactive}
        />
      ))}
    </span>
  )
}

function resultMessage(result: RoundResult): string {
  const winner = result.hands.find(hand => hand.playerId === result.winnerId)
  return `${winner?.name} went out and scores ${result.points}`
}

function SuitPicker({ onChoose }: { onChoose: (suit: Suit) => void }) {
  return (
    <div className="panel-actions">
      <p className="hint">Choose a suit for the eight</p>
      {SUIT_ORDER.map(suit => (
        <button type="button" key={suit} className="btn-secondary" onClick={() => onChoose(suit)}>
          {SUIT_SYMBOLS[suit]}
        </button>
      ))}
    </div>
  )
}

function SeatPanel({
  hand,
  score,
  round,
  visible,
  canToggle,
  matchWinnerName,
  onToggle,
  onDraw,
  onPass,
  onPlay,
  onDeal,
  onNewGame,
  selected,
  onSelect,
  choosingSuit,
  onChooseSuit,
}: {
  hand: Hand
  score: number
  round: Round
  visible: boolean
  canToggle: boolean
  matchWinnerName: string | null
  onToggle: () => void
  onDraw: () => void
  onPass: () => void
  onPlay: () => void
  onDeal: () => void
  onNewGame: () => void
  selected: Card | null
  onSelect: (card: Card) => void
  choosingSuit: boolean
  onChooseSuit: (suit: Suit) => void
}) {
  const result = round.result
  const active = result === null && round.turn === hand.playerId
  const anyPlayable = active && canPlayAny(round, hand.playerId)
  const playable = selected !== null && canPlay(round, hand.playerId, selected)
  const drawing = active && canDraw(round, hand.playerId)
  const passing = active && canPass(round, hand.playerId)

  const status =
    result !== null
      ? `${hand.cards.length} card${hand.cards.length === 1 ? '' : 's'} left`
      : active
        ? round.pendingPickup > 0
          ? `Pick up ${round.pendingPickup} or play a two`
          : anyPlayable
            ? 'Your turn'
            : 'Your turn — draw a card'
        : 'Waiting'

  return (
    <section className={`seat-panel${active ? ' seat-panel--active' : ''}`}>
      <header className="seat-panel-header">
        <h2>{hand.name}</h2>
        <span className="seat-panel-status">{status}</span>
        <span className="seat-panel-score">{score} pts</span>
      </header>

      {visible ? (
        <HandCards
          cards={hand.cards}
          selected={selected}
          onSelect={result === null && active ? onSelect : null}
          drawn={active ? round.drawn : null}
          interactive={result === null && active}
        />
      ) : (
        <HiddenHand count={hand.cards.length} />
      )}

      {result === null ? (
        choosingSuit ? (
          <SuitPicker onChoose={onChooseSuit} />
        ) : (
          <div className="panel-actions">
            {canToggle && (
              <button type="button" className="btn-secondary" onClick={onToggle}>
                {visible ? 'Hide cards' : 'Show cards'}
              </button>
            )}

            {active && visible && (
              <>
                <button type="button" className="btn-primary" disabled={!playable} onClick={onPlay}>
                  {selected === null ? 'Pick a card' : `Play ${cardLabel(selected)}`}
                </button>
                {drawing && (
                  <button type="button" className="btn-secondary" onClick={onDraw}>
                    {round.pendingPickup > 0 ? `Pick up ${round.pendingPickup}` : `Draw (${round.stock.length})`}
                  </button>
                )}
                {passing && (
                  <button type="button" className="btn-secondary" onClick={onPass}>
                    Keep it — pass
                  </button>
                )}
              </>
            )}
          </div>
        )
      ) : (
        <div className="panel-actions">
          {matchWinnerName === null ? (
            <button type="button" className="btn-primary" onClick={onDeal}>
              Next hand
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onNewGame}>
              New game
            </button>
          )}
        </div>
      )}

      {result === null && active && !visible && (
        <p className="hint">
          {canToggle ? 'Show your cards to take your turn' : 'Tip the device towards you to see your hand'}
        </p>
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

export default function CrazyEights({ players, onExit }: CrazyEightsProps) {
  const { tilt, tiltAccess, portrait, locked, canLock, enable } = useDeviceView()
  const [state, setState] = usePersistentState<CrazyEightsState>(
    STORAGE_KEYS.crazyEights,
    () => ({
      round: createRound(players, players[0]?.id),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
      lastStarterId: players[0]?.id ?? null,
    }),
    isCrazyEightsState,
  )
  // Reveals reset on refresh, so a shared device never comes back showing a hand.
  const [revealed, setRevealed] = useState<string[]>([])
  const [selected, setSelected] = useState<Card | null>(null)
  const [choosingSuitFor, setChoosingSuitFor] = useState<Card | null>(null)

  const { round, scores } = state

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

  const result = round.result

  const setRound = (next: Round) => {
    setState(current => {
      if (next.result === null || current.round?.result !== null) {
        return { ...current, round: next }
      }

      const winnerId = next.result.winnerId
      const nextScores = { ...current.scores, [winnerId]: (current.scores[winnerId] ?? 0) + next.result.points }

      return { ...current, round: next, scores: nextScores }
    })
  }

  const act = (next: Round) => {
    setSelected(null)
    setChoosingSuitFor(null)
    setRound(next)
    if (next.result !== null) {
      setRevealed(next.hands.map(hand => hand.playerId))
    } else if (next.turn !== round.turn) {
      // Hands go back face down as soon as the turn passes over.
      setRevealed(current => current.filter(playerId => playerId !== round.turn))
    }
  }

  const playSelected = (playerId: string, card: Card, chosenSuit?: Suit) => {
    if (card.rank === WILD_RANK && chosenSuit === undefined) {
      setChoosingSuitFor(card)
      return
    }
    act(playCard(round, playerId, card, chosenSuit))
  }

  const deal = () => {
    setSelected(null)
    setChoosingSuitFor(null)
    setRevealed([])
    setState(current => {
      const starter = opponentOf(round, current.lastStarterId ?? round.hands[0].playerId).playerId
      return { ...current, round: createRound(players, starter), lastStarterId: starter }
    })
  }

  const newGame = () => {
    setSelected(null)
    setChoosingSuitFor(null)
    setRevealed([])
    setState({
      round: createRound(players, players[0]?.id),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
      lastStarterId: players[0]?.id ?? null,
    })
  }

  // The page stays in portrait and each seat is turned a quarter turn to face
  // its own player, so angling the device towards someone only moves the tilt
  // reading — the browser never spins the layout out from under them.
  const [left, right] = round.hands
  const tilted = tiltAccess === 'granted'
  const facing = tilt === 'left' ? left : tilt === 'right' ? right : null

  const isVisible = (hand: Hand) => {
    if (result !== null) return true
    if (tilted) return facing?.playerId === hand.playerId
    return revealed.includes(hand.playerId)
  }

  const toggle = (hand: Hand) => {
    setSelected(null)
    setChoosingSuitFor(null)
    setRevealed(current =>
      current.includes(hand.playerId)
        ? current.filter(entry => entry !== hand.playerId)
        : [...current, hand.playerId],
    )
  }

  const matchWinner = Object.entries(scores).find(([, points]) => points >= TARGET_SCORE)
  const matchWinnerName = round.hands.find(hand => hand.playerId === matchWinner?.[0])?.name ?? null

  const panelFor = (hand: Hand) => (
    <SeatPanel
      hand={hand}
      score={scores[hand.playerId] ?? 0}
      round={round}
      visible={isVisible(hand)}
      canToggle={!tilted && result === null}
      matchWinnerName={matchWinnerName}
      onToggle={() => toggle(hand)}
      onDraw={() => act(draw(round, hand.playerId))}
      onPass={() => act(pass(round, hand.playerId))}
      onPlay={() => selected !== null && playSelected(hand.playerId, selected)}
      onDeal={deal}
      onNewGame={newGame}
      selected={round.turn === hand.playerId ? selected : null}
      onSelect={card => setSelected(card)}
      choosingSuit={choosingSuitFor !== null && round.turn === hand.playerId}
      onChooseSuit={suit => choosingSuitFor !== null && playSelected(hand.playerId, choosingSuitFor, suit)}
    />
  )

  const topCard = topOfDiscard(round)
  const setupNeeded = tiltAccess === 'prompt' || (canLock && !locked)

  return (
    <main className="view-rummy view-rummy--table">
      <div className="rummy-table">
        <RotatedSeat degrees={90}>{panelFor(left)}</RotatedSeat>

        {/* Only the shared piles sit in the middle, since it's the one strip
            that can't face both players at once. */}
        <div className="rummy-centre">
          <button type="button" className="btn-ghost" onClick={onExit}>
            Exit
          </button>

          <div className="piles">
            <div className="pile">
              <CardFace faceDown />
              <span className="pile-label">{round.stock.length}</span>
            </div>
            <div className="pile">
              {topCard === null ? <span className="hand-card hand-card--empty" /> : <CardFace card={topCard} />}
              <span className="pile-label">{SUIT_SYMBOLS[round.activeSuit]}</span>
            </div>
            {round.pendingPickup > 0 && (
              <div className="pile">
                <span className="pile-label">+{round.pendingPickup}</span>
              </div>
            )}
          </div>

          {setupNeeded ? (
            <button type="button" className="btn-secondary" onClick={enable}>
              Tilt setup
            </button>
          ) : (
            !portrait && <span className="pile-label">Turn upright</span>
          )}
        </div>

        <RotatedSeat degrees={-90}>{panelFor(right)}</RotatedSeat>
      </div>

      {result !== null && (
        <div className="rummy-centre">
          <p className="seat-panel-result">{resultMessage(result)}</p>
          {matchWinnerName !== null && <p className="seat-panel-result">{matchWinnerName} wins the game!</p>}
        </div>
      )}
    </main>
  )
}
