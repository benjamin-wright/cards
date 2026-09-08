import { useState, type ReactNode } from 'react'
import type { Card } from '../cards'
import { cardKey } from '../cards'
import { SUIT_SYMBOLS } from '../games'
import type { Player } from '../players'
import { useDeviceView } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import { KNOCK_LIMIT, bestLayout, type Layout, type Meld } from './melds'
import {
  TARGET_SCORE,
  canKnockWith,
  createRound,
  discard,
  drawFromDiscard,
  drawFromStock,
  isRound,
  knock,
  opponentOf,
  topOfDiscard,
  type Hand,
  type Round,
  type RoundResult,
  type ScoredHand,
} from './round'

type RummyProps = {
  players: Player[]
  onExit: () => void
}

type RummyState = {
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

function isRummyState(value: unknown): value is RummyState {
  const state = value as Partial<RummyState>
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
      <span className="game-bar-title">Rummy</span>
      <button type="button" className="btn-ghost" onClick={onExit}>
        Exit
      </button>
    </div>
  )
}

function MeldGroup({
  label,
  cards,
  selected,
  onSelect,
  drawn,
  interactive,
}: {
  label: string
  cards: Card[]
  selected: Card | null
  onSelect: ((card: Card) => void) | null
  drawn: Card | null
  interactive: boolean
}) {
  if (cards.length === 0) return null

  return (
    <div className={`meld meld--${label.toLowerCase()}`}>
      <span className="meld-label">{label}</span>
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
    </div>
  )
}

/** Sets and runs are formed automatically, so a hand is always shown grouped. */
function GroupedHand({
  layout,
  selected,
  onSelect,
  drawn,
  interactive,
}: {
  layout: Layout
  selected: Card | null
  onSelect: ((card: Card) => void) | null
  drawn: Card | null
  interactive: boolean
}) {
  return (
    <div className="grouped-hand">
      {layout.melds.map((meld: Meld, index) => (
        <MeldGroup
          key={`${meld.kind}-${index}-${cardKey(meld.cards[0])}`}
          label={meld.kind === 'set' ? 'Set' : 'Run'}
          cards={meld.cards}
          selected={selected}
          onSelect={onSelect}
          drawn={drawn}
          interactive={interactive}
        />
      ))}
      <MeldGroup
        label="Deadwood"
        cards={layout.deadwood}
        selected={selected}
        onSelect={onSelect}
        drawn={drawn}
        interactive={interactive}
      />
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

function ScoredSummary({ hand, knocked }: { hand: ScoredHand; knocked: boolean }) {
  return (
    <div className="grouped-hand">
      {hand.melds.map((meld, index) => (
        <MeldGroup
          key={`${meld.kind}-${index}-${cardKey(meld.cards[0])}`}
          label={meld.kind === 'set' ? 'Set' : 'Run'}
          cards={meld.cards}
          selected={null}
          onSelect={null}
          drawn={null}
          interactive={false}
        />
      ))}
      <MeldGroup
        label="Deadwood"
        cards={hand.deadwood}
        selected={null}
        onSelect={null}
        drawn={null}
        interactive={false}
      />
      <p className="hint">
        {knocked ? 'Knocked — ' : ''}
        Deadwood {hand.deadwoodValue}
      </p>
    </div>
  )
}

function resultMessage(result: RoundResult): string {
  const winner = result.hands.find(hand => hand.playerId === result.winnerId)
  if (result.kind === 'draw') return 'Stock exhausted — no score'
  if (result.kind === 'gin') return `Gin! ${winner?.name} scores ${result.points}`
  if (result.kind === 'undercut') return `Undercut! ${winner?.name} scores ${result.points}`
  return `${winner?.name} knocked and scores ${result.points}`
}

function SeatPanel({
  hand,
  score,
  round,
  visible,
  canToggle,
  matchWinnerName,
  onToggle,
  onDrawStock,
  onDrawDiscard,
  onDiscard,
  onKnock,
  onDeal,
  onNewGame,
  selected,
  onSelect,
}: {
  hand: Hand
  score: number
  round: Round
  visible: boolean
  canToggle: boolean
  matchWinnerName: string | null
  onToggle: () => void
  onDrawStock: () => void
  onDrawDiscard: () => void
  onDiscard: () => void
  onKnock: () => void
  onDeal: () => void
  onNewGame: () => void
  selected: Card | null
  onSelect: (card: Card) => void
}) {
  const result = round.result
  const active = result === null && round.turn === hand.playerId
  const layout = bestLayout(hand.cards)
  const scored = result?.hands.find(entry => entry.playerId === hand.playerId) ?? null
  const top = topOfDiscard(round)
  const knockable = selected !== null && canKnockWith(round, hand.playerId, selected)
  const gin =
    knockable &&
    selected !== null &&
    bestLayout(hand.cards.filter(card => cardKey(card) !== cardKey(selected))).deadwoodValue === 0

  const status =
    result !== null
      ? `Deadwood ${scored?.deadwoodValue ?? 0}`
      : visible
        ? `Deadwood ${layout.deadwoodValue}`
        : active
          ? 'Your turn'
          : 'Waiting'

  return (
    <section className={`seat-panel${active ? ' seat-panel--active' : ''}`}>
      <header className="seat-panel-header">
        <h2>{hand.name}</h2>
        <span className="seat-panel-status">{status}</span>
        <span className="seat-panel-score">{score} pts</span>
      </header>

      {result !== null && scored !== null ? (
        <ScoredSummary hand={scored} knocked={result.knockerId === hand.playerId} />
      ) : visible ? (
        <GroupedHand
          layout={layout}
          selected={selected}
          onSelect={round.phase === 'discard' && active ? onSelect : null}
          drawn={active ? round.drawn : null}
          interactive={round.phase === 'discard' && active}
        />
      ) : (
        <HiddenHand count={hand.cards.length} />
      )}

      {/* Each player's own copy of the table state, turned to face them, so
          nobody has to read anything sideways. */}
      {result === null ? (
        <div className="panel-actions">
          {canToggle && (
            <button type="button" className="btn-secondary" onClick={onToggle}>
              {visible ? 'Hide cards' : 'Show cards'}
            </button>
          )}

          {active && visible && round.phase === 'draw' && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={round.stock.length === 0}
                onClick={onDrawStock}
              >
                Draw ({round.stock.length})
              </button>
              <button type="button" className="btn-secondary" disabled={top === null} onClick={onDrawDiscard}>
                Take {top === null ? '—' : cardLabel(top)}
              </button>
            </>
          )}

          {active && visible && round.phase === 'discard' && (
            <>
              <button type="button" className="btn-primary" disabled={selected === null} onClick={onDiscard}>
                {selected === null ? 'Pick a card' : `Discard ${cardLabel(selected)}`}
              </button>
              <button type="button" className="btn-secondary" disabled={!knockable} onClick={onKnock}>
                {gin ? 'Gin' : 'Knock'}
              </button>
            </>
          )}
        </div>
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

      {result !== null && <p className="seat-panel-result">{resultMessage(result)}</p>}
      {result !== null && matchWinnerName !== null && (
        <p className="seat-panel-result">{matchWinnerName} wins the game!</p>
      )}
      {result === null && active && !visible && (
        <p className="hint">
          {canToggle ? 'Show your cards to take your turn' : 'Tip the device towards you to see your hand'}
        </p>
      )}
      {result === null && active && visible && round.phase === 'discard' && selected === null && (
        <p className="hint">Tap a card to discard it (knock at {KNOCK_LIMIT} deadwood or less)</p>
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

export default function Rummy({ players, onExit }: RummyProps) {
  const { tilt, tiltAccess, portrait, locked, canLock, enable } = useDeviceView()
  const [state, setState] = usePersistentState<RummyState>(
    STORAGE_KEYS.rummy,
    () => ({
      round: createRound(players, players[0]?.id),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
      lastStarterId: players[0]?.id ?? null,
    }),
    isRummyState,
  )
  // Reveals reset on refresh, so a shared device never comes back showing a hand.
  const [revealed, setRevealed] = useState<string[]>([])
  const [selected, setSelected] = useState<Card | null>(null)

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
      const nextScores =
        winnerId === null
          ? current.scores
          : { ...current.scores, [winnerId]: (current.scores[winnerId] ?? 0) + next.result.points }

      return { ...current, round: next, scores: nextScores }
    })
  }

  const act = (next: Round) => {
    setSelected(null)
    setRound(next)
    if (next.result !== null) {
      setRevealed(next.hands.map(hand => hand.playerId))
    } else if (next.turn !== round.turn) {
      // Hands go back face down as soon as the turn passes over.
      setRevealed(current => current.filter(playerId => playerId !== round.turn))
    }
  }

  const deal = () => {
    setSelected(null)
    setRevealed([])
    setState(current => {
      const starter = opponentOf(round, current.lastStarterId ?? round.hands[0].playerId).playerId
      return { ...current, round: createRound(players, starter), lastStarterId: starter }
    })
  }

  const newGame = () => {
    setSelected(null)
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
      onDrawStock={() => act(drawFromStock(round, hand.playerId))}
      onDrawDiscard={() => act(drawFromDiscard(round, hand.playerId))}
      onDiscard={() => selected !== null && act(discard(round, hand.playerId, selected))}
      onKnock={() => selected !== null && act(knock(round, hand.playerId, selected))}
      onDeal={deal}
      onNewGame={newGame}
      selected={round.turn === hand.playerId ? selected : null}
      onSelect={card => setSelected(card)}
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
            </div>
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
    </main>
  )
}
