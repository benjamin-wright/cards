import { useEffect } from 'react'
import type { Player } from '../players'
import type { Tilt } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import { handScore } from './engine'
import { createRound, isRound, revealHands, stick, twist, type Round, type Seat } from './round'

type BlackjackState = {
  round: Round
  scores: Record<string, number>
  /** Absent on older completed hands, which already had their scores awarded. */
  reveal?: 'revealing' | 'summary'
}

function isBlackjackState(value: unknown): value is BlackjackState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Partial<BlackjackState>
  return isRound(state.round) &&
    (state.reveal === undefined || state.reveal === 'revealing' || state.reveal === 'summary') &&
    typeof state.scores === 'object' && state.scores !== null && !Array.isArray(state.scores) &&
    Object.values(state.scores).every(score => typeof score === 'number' && Number.isFinite(score) && score >= 0)
}

function SeatPanel({
  seat,
  round,
  points,
  onTwist,
  onStick,
}: {
  seat: Seat
  round: Round
  points: number
  onTwist: () => void
  onStick: () => void
}) {
  const active = round.result === null && (seat.status === 'playing' || seat.status === 'waiting')
  return (
    <section className="seat-panel">
      <header className="seat-panel-header">
        <h2>{seat.name}</h2>
        <span className="seat-panel-status">{points} points</span>
      </header>
      <span className="hand">
        {seat.cards.map(card => (
          <CardFace key={`${card.rank}-${card.suit}`} card={card} />
        ))}
      </span>
      <p className="hint">
        {seat.status === 'bust'
            ? `Bust on ${handScore(seat.cards)}`
            : seat.status === 'stood'
              ? `Stuck on ${handScore(seat.cards)}`
              : active
                ? `Your hand — ${handScore(seat.cards)}`
                : 'Hand complete'}
      </p>
      {active && (
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onTwist}>Twist</button>
          <button type="button" className="btn-secondary" onClick={onStick}>Stick</button>
        </div>
      )}
    </section>
  )
}

export default function Blackjack({ players, tilt, onExit }: {
  players: Player[]
  tilt: Tilt
  onExit: () => void
}) {
  const [state, setState] = usePersistentState<BlackjackState>(
    STORAGE_KEYS.blackjack,
    () => ({
      round: createRound(players),
      scores: Object.fromEntries(players.map(player => [player.id, 0])),
    }),
    isBlackjackState,
  )
  const { round, scores } = state
  const [left, right] = round.seats
  const ready = round.result === null &&
    round.seats.every(seat => seat.status === 'stood' || seat.status === 'bust')
  const revealing = round.result !== null && state.reveal === 'revealing'
  const summary = round.result !== null && !revealing

  useEffect(() => {
    if (!revealing) return
    const timeout = window.setTimeout(() => {
      setState(current => current.reveal === 'revealing'
        ? { ...current, reveal: 'summary' }
        : current)
    }, 1400)
    return () => window.clearTimeout(timeout)
  }, [revealing, setState])

  const act = (next: Round) => {
    setState(current => {
      if (current.round !== round) return current
      return { ...current, round: next }
    })
  }

  const showHands = () => {
    if (tilt !== 'flat') return
    setState(current => {
      if (current.round !== round) return current
      const next = revealHands(current.round)
      if (next === current.round) return current
      const winnerId = next.result?.winnerId
      return {
        ...current,
        round: next,
        reveal: 'revealing',
        scores: winnerId
          ? { ...current.scores, [winnerId]: (current.scores[winnerId] ?? 0) + 1 }
          : current.scores,
      }
    })
  }

  const deal = () => {
    setState(current => {
      if (current.round.result === null) return current
      return { ...current, round: createRound(players), reveal: undefined }
    })
  }

  const panelFor = (seat: Seat) => (
    <SeatPanel
      seat={seat}
      round={round}
      points={scores[seat.playerId] ?? 0}
      onTwist={() => act(twist(round, seat.playerId))}
      onStick={() => act(stick(round, seat.playerId))}
    />
  )

  return (
    <main className="view-blackjack view-blackjack--table">
      <div className="blackjack-table" data-tilt={tilt}>
        <RotatedSeat degrees={90} revealed={!revealing && !summary && tilt === 'left'}>{panelFor(left)}</RotatedSeat>
        <div className={`blackjack-centre${revealing || summary ? ' blackjack-centre--showdown' : ''}`}>
          <button type="button" className="btn-ghost" onClick={onExit}>Exit</button>
          {round.result === null ? (
            <>
              <span>{ready ? 'Both players have finished. Set the phone flat to share the hands.' : 'Each player can twist or stick when ready'}</span>
              <button type="button" className="btn-primary" disabled={!ready || tilt !== 'flat'} onClick={showHands}>
                Show hands
              </button>
            </>
          ) : null}
        </div>
        <RotatedSeat degrees={-90} revealed={!revealing && !summary && tilt === 'right'}>{panelFor(right)}</RotatedSeat>
        {(revealing || summary) && (
          <div className={`blackjack-showdown${revealing ? ' blackjack-showdown--entering' : ''}`}>
            {round.seats.map((seat, index) => (
              <div key={seat.playerId} className={`blackjack-showdown-hand blackjack-showdown-hand--${index === 0 ? 'left' : 'right'}`}>
                <h2>{seat.name}</h2>
                <span className="hand">
                  {seat.cards.map((card, cardIndex) => (
                    <span key={`${card.rank}-${card.suit}`} className="blackjack-showdown-card" style={{ animationDelay: `${cardIndex * 80}ms` }}>
                      <CardFace card={card} />
                    </span>
                  ))}
                </span>
                <span>{handScore(seat.cards)}{seat.status === 'bust' ? ' — Bust' : ''}</span>
              </div>
            ))}
            {summary && (
              <div className="blackjack-summary" role="dialog" aria-labelledby="blackjack-summary-title">
                <h2 id="blackjack-summary-title">
                  {round.result?.winnerId === null
                    ? 'Draw'
                    : `${round.seats.find(seat => seat.playerId === round.result?.winnerId)?.name} wins!`}
                </h2>
                <p>
                  {round.seats.map(seat =>
                    round.result?.winnerId === seat.playerId
                      ? `${seat.name}: ${(scores[seat.playerId] ?? 0) - 1} + 1`
                      : `${seat.name}: ${scores[seat.playerId] ?? 0}`
                  ).join(' · ')}
                </p>
                <button type="button" className="btn-primary" onClick={deal}>Next hand</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
