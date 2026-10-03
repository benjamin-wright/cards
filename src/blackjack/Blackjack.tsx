import type { Player } from '../players'
import type { Tilt } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import CardFace from '../views/CardFace'
import RotatedSeat from '../views/RotatedSeat'
import { handScore } from './engine'
import { createRound, isRound, stick, twist, type Round, type Seat } from './round'

type BlackjackState = {
  round: Round
  scores: Record<string, number>
  lastStarterId: string
}

function isBlackjackState(value: unknown): value is BlackjackState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Partial<BlackjackState>
  return isRound(state.round) && typeof state.lastStarterId === 'string' &&
    typeof state.scores === 'object' && state.scores !== null && !Array.isArray(state.scores) &&
    Object.values(state.scores).every(score => typeof score === 'number' && Number.isFinite(score) && score >= 0)
}

function SeatPanel({
  seat,
  round,
  points,
  onTwist,
  onStick,
  onDeal,
}: {
  seat: Seat
  round: Round
  points: number
  onTwist: () => void
  onStick: () => void
  onDeal: () => void
}) {
  const active = round.turn === seat.playerId
  const result = round.result
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
        {result !== null
          ? `${result.winnerId === seat.playerId ? 'Won +1 point' : result.winnerId === null ? 'Draw' : 'Lost'} — ${handScore(seat.cards)}`
          : seat.status === 'bust'
            ? `Bust on ${handScore(seat.cards)}`
            : seat.status === 'stood'
              ? `Stuck on ${handScore(seat.cards)}`
              : active
                ? `Your turn — ${handScore(seat.cards)}`
                : 'Waiting for your turn'}
      </p>
      {active && (
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onTwist}>Twist</button>
          <button type="button" className="btn-secondary" onClick={onStick}>Stick</button>
        </div>
      )}
      {result !== null && (
        <button type="button" className="btn-primary" onClick={onDeal}>Next hand</button>
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
      lastStarterId: players[0].id,
    }),
    isBlackjackState,
  )
  const { round, scores } = state
  const [left, right] = round.seats

  const act = (next: Round) => {
    setState(current => {
      if (current.round !== round) return current
      const winnerId = next.result?.winnerId
      return {
        ...current,
        round: next,
        scores: round.result === null && winnerId
          ? { ...current.scores, [winnerId]: (current.scores[winnerId] ?? 0) + 1 }
          : current.scores,
      }
    })
  }

  const deal = () => {
    setState(current => {
      if (current.round.result === null) return current
      const starterId = current.lastStarterId === left.playerId ? right.playerId : left.playerId
      return { ...current, round: createRound(players, starterId), lastStarterId: starterId }
    })
  }

  const panelFor = (seat: Seat) => (
    <SeatPanel
      seat={seat}
      round={round}
      points={scores[seat.playerId] ?? 0}
      onTwist={() => act(twist(round, seat.playerId))}
      onStick={() => act(stick(round, seat.playerId))}
      onDeal={deal}
    />
  )

  return (
    <main className="view-blackjack view-blackjack--table">
      <div className="blackjack-table" data-tilt={tilt}>
        <RotatedSeat degrees={90} revealed={tilt === 'left'}>{panelFor(left)}</RotatedSeat>
        <div className="blackjack-centre">
          <button type="button" className="btn-ghost" onClick={onExit}>Exit</button>
          <span>{round.result === null ? 'Tilt towards the current player' : 'Hand complete'}</span>
        </div>
        <RotatedSeat degrees={-90} revealed={tilt === 'right'}>{panelFor(right)}</RotatedSeat>
      </div>
    </main>
  )
}
