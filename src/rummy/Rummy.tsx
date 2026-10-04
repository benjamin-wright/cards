import { useState, type ReactNode } from 'react'
import type { Card } from '../cards'
import { cardKey } from '../cards'
import { SUIT_SYMBOLS } from '../games'
import type { Player } from '../players'
import type { Tilt } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import TableReveal from '../views/TableReveal'
import { KNOCK_LIMIT, bestLayout, type Layout, type Meld } from './melds'
import {
  TARGET_SCORE,
  canKnockNow,
  canKnockWith,
  createRound,
  discard,
  drawFromDiscard,
  drawFromStock,
  isRound,
  knock,
  knockNow,
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
  /** Older settled hands already have their match points applied. */
  revealed?: boolean
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
    (state.revealed === undefined || typeof state.revealed === 'boolean') &&
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
  matchWinnerName,
  onDrawStock,
  onDrawDiscard,
  onDiscard,
  onKnock,
  onKnockNow,
  onDeal,
  onNewGame,
  selected,
  onSelect,
}: {
  hand: Hand
  score: number
  round: Round
  visible: boolean
  matchWinnerName: string | null
  onDrawStock: () => void
  onDrawDiscard: () => void
  onDiscard: () => void
  onKnock: () => void
  onKnockNow: () => void
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
  // A knock is easy to miss while picking a discard, so it stays offered on
  // the finished hand until the next card is drawn — including on the
  // opponent's turn, since a tilted-away player can't reach the button.
  const knockableNow = canKnockNow(round, hand.playerId)

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
          {visible && knockableNow && (
            <button type="button" className="btn-secondary" onClick={onKnockNow}>
              {layout.deadwoodValue === 0 ? 'Gin' : `Knock on ${layout.deadwoodValue}`}
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
        <p className="hint">Tip the device towards you to see your hand</p>
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

export default function Rummy({ players, tilt, onExit }: RummyProps & { tilt: Tilt }) {
  const [state, setState] = usePersistentState<RummyState>(
    STORAGE_KEYS.rummy,
    () => ({
      round: createRound(players, players[0]?.id),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
      lastStarterId: players[0]?.id ?? null,
    }),
    isRummyState,
  )
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

      return { ...current, round: next, revealed: false }
    })
  }

  const showResult = () => {
    if (tilt !== 'flat') return
    setState(current => {
      if (current.round === null || current.round.result === null || current.revealed !== false) return current
      const result = current.round.result
      const winnerId = result.winnerId
      return {
        ...current,
        revealed: true,
        scores: winnerId === null
          ? current.scores
          : { ...current.scores, [winnerId]: (current.scores[winnerId] ?? 0) + result.points },
      }
    })
  }

  const act = (next: Round) => {
    setSelected(null)
    setRound(next)
  }

  const deal = () => {
    setSelected(null)
    setState(current => {
      const starter = opponentOf(round, current.lastStarterId ?? round.hands[0].playerId).playerId
      return { ...current, round: createRound(players, starter), lastStarterId: starter, revealed: undefined }
    })
  }

  const newGame = () => {
    setSelected(null)
    setState({
      round: createRound(players, players[0]?.id),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
      lastStarterId: players[0]?.id ?? null,
    })
  }

  const [left, right] = round.hands
  const facing = tilt === 'left' ? left : tilt === 'right' ? right : null
  const pending = result !== null && state.revealed === false
  const publicResult = result !== null && !pending && tilt === 'flat'

  const isVisible = (hand: Hand) => {
    if (result !== null) return false
    return facing?.playerId === hand.playerId
  }

  const matchWinner = Object.entries(scores).find(([, points]) => points >= TARGET_SCORE)
  const matchWinnerName = round.hands.find(hand => hand.playerId === matchWinner?.[0])?.name ?? null

  const panelFor = (hand: Hand) => (
    <SeatPanel
      hand={hand}
      score={scores[hand.playerId] ?? 0}
      round={round}
      visible={isVisible(hand)}
      matchWinnerName={matchWinnerName}
      onDrawStock={() => act(drawFromStock(round, hand.playerId))}
      onDrawDiscard={() => act(drawFromDiscard(round, hand.playerId))}
      onDiscard={() => selected !== null && act(discard(round, hand.playerId, selected))}
      onKnock={() => selected !== null && act(knock(round, hand.playerId, selected))}
      onKnockNow={() => act(knockNow(round, hand.playerId))}
      onDeal={deal}
      onNewGame={newGame}
      selected={round.turn === hand.playerId ? selected : null}
      onSelect={card => setSelected(card)}
    />
  )

  const topCard = topOfDiscard(round)

  return (
    <main className="view-rummy view-rummy--table">
      <div className="rummy-table" data-tilt={tilt}>
        <RotatedSeat degrees={90} revealed={result === null && tilt === 'left'}>{panelFor(left)}</RotatedSeat>

        {/* Shared piles move to the free side when a player's seat opens. */}
        <div className="rummy-centre">
          <button type="button" className="btn-ghost" onClick={onExit}>
            Exit
          </button>

          {pending && <button type="button" className="btn-primary" disabled={tilt !== 'flat'} onClick={showResult}>Show hands</button>}
          {result !== null && tilt !== 'flat' && <span className="pile-label">Set the phone flat to show the hands</span>}
          {result === null && <div className="piles">
            <div className="pile">
              <CardFace faceDown />
              <span className="pile-label">{round.stock.length}</span>
            </div>
            <div className="pile">
              {topCard === null ? <span className="hand-card hand-card--empty" /> : <CardFace card={topCard} />}
            </div>
          </div>}

        </div>

        <RotatedSeat degrees={-90} revealed={result === null && tilt === 'right'}>{panelFor(right)}</RotatedSeat>
        {publicResult && (
          <TableReveal
            hands={round.hands.map(hand => ({
              playerId: hand.playerId,
              name: hand.name,
              cards: hand.cards,
              detail: `Deadwood ${result.hands.find(scored => scored.playerId === hand.playerId)?.deadwoodValue ?? 0} · ${scores[hand.playerId] ?? 0} pts`,
            }))}
            title={`${resultMessage(result)}${matchWinnerName === null ? '' : ` — ${matchWinnerName} wins the game!`}`}
            onContinue={matchWinnerName === null ? deal : newGame}
            continueLabel={matchWinnerName === null ? 'Next hand' : 'New game'}
            onExit={onExit}
          />
        )}
      </div>
    </main>
  )
}
