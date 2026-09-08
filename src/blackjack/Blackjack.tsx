import type { ReactNode } from 'react'
import type { Player } from '../players'
import { MIN_PLAYERS } from '../players'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import { ANTE, affordableRaises, handScore, type Card } from './engine'
import {
  canAnte,
  createRound,
  finishRound,
  isRound,
  raiseBet,
  stick,
  twist,
  type Result,
  type Round,
  type Seat,
} from './round'
import CardFace from '../views/CardFace'

type BlackjackProps = {
  players: Player[]
  onSettle: (results: Result[]) => void
  onExit: () => void
}

type BlackjackState = {
  round: Round | null
  viewIndex: number
  revealed: boolean
}

function isBlackjackState(value: unknown): value is BlackjackState {
  const state = value as Partial<BlackjackState>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof state.viewIndex === 'number' &&
    typeof state.revealed === 'boolean' &&
    (state.round === null || isRound(state.round))
  )
}

function Screen({ onExit, children }: { onExit: () => void; children: ReactNode }) {
  return (
    <main className="view-blackjack">
      <div className="game-bar">
        <span className="game-bar-title">Blackjack</span>
        <button type="button" className="btn-ghost" onClick={onExit}>
          Exit
        </button>
      </div>
      {children}
    </main>
  )
}

function Hand({ cards, faceDown }: { cards: Card[]; faceDown: boolean }) {
  return (
    <span className="hand">
      {cards.map((card, index) => (
        <CardFace key={`${card.rank}-${card.suit}-${index}`} card={card} faceDown={faceDown} />
      ))}
    </span>
  )
}

function statusLabel(seat: Seat): string {
  if (seat.status === 'bust') return 'Bust'
  if (seat.status === 'stood') return 'Stuck'
  if (seat.status === 'playing') return 'Playing'
  return 'Waiting'
}

function Standings({ seats, activeIndex }: { seats: Seat[]; activeIndex: number }) {
  return (
    <ul className="standings">
      {seats.map((seat, index) => (
        <li key={seat.playerId} className={`standing${index === activeIndex ? ' standing--active' : ''}`}>
          <span className="standing-name">{seat.name}</span>
          <span className="standing-status">{statusLabel(seat)}</span>
          <span className="standing-bet">Bet £{seat.bet}</span>
          <span className="standing-cash">£{seat.cash}</span>
        </li>
      ))}
    </ul>
  )
}

function deal(players: Player[]): BlackjackState {
  const able = players.filter(canAnte)
  return {
    round: able.length >= MIN_PLAYERS ? createRound(able) : null,
    viewIndex: 0,
    revealed: false,
  }
}

export default function Blackjack({ players, onSettle, onExit }: BlackjackProps) {
  const [state, setState] = usePersistentState<BlackjackState>(
    STORAGE_KEYS.blackjack,
    () => deal(players),
    isBlackjackState,
  )

  const { round, viewIndex, revealed } = state
  const setRound = (next: Round) => setState(current => ({ ...current, round: next }))

  if (round === null) {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>Not enough players</h1>
          <p className="tagline">
            At least {MIN_PLAYERS} players need £{ANTE} to cover the entry fee.
          </p>
        </header>
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </Screen>
    )
  }

  const seats = round.seats
  const turnOver = round.activeIndex !== viewIndex
  const finishedSeat = turnOver ? seats[viewIndex] : null

  const revealHouse = () => {
    const settled = finishRound(round)
    setRound(settled)
    if (settled.results !== null) {
      onSettle(settled.results)
    }
  }

  if (round.phase === 'summary' && round.results !== null) {
    const results = round.results
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>Hand over</h1>
        </header>

        <section className="panel">
          <h2>House — {handScore(round.house)}</h2>
          <Hand cards={round.house} faceDown={false} />
        </section>

        <ul className="results">
          {seats.map(seat => {
            const result = results.find(entry => entry.playerId === seat.playerId)!
            return (
              <li key={seat.playerId} className={`result result--${result.outcome}`}>
                <div className="result-head">
                  <span className="result-name">{seat.name}</span>
                  <span className="result-score">{result.score}</span>
                </div>
                <Hand cards={seat.cards} faceDown={false} />
                <div className="result-money">
                  <span>Bet £{result.bet}</span>
                  <span className="result-outcome">
                    {result.outcome === 'win' ? 'Won' : result.outcome === 'lose' ? 'Lost' : 'Draw'}
                    {' '}
                    {result.delta === 0 ? '£0' : `${result.delta > 0 ? '+' : '-'}£${Math.abs(result.delta)}`}
                  </span>
                  <span className="result-total">Total £{result.cashAfter}</span>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={() => setState(deal(players))}>
            Play another hand
          </button>
          <button type="button" className="btn-secondary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </Screen>
    )
  }

  if (turnOver && finishedSeat) {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>{finishedSeat.name}</h1>
          <p className="tagline">
            {finishedSeat.status === 'bust'
              ? `Bust on ${handScore(finishedSeat.cards)}`
              : `Stuck on ${handScore(finishedSeat.cards)}`}
          </p>
        </header>

        <section className="panel">
          <Hand cards={finishedSeat.cards} faceDown={false} />
        </section>

        <div className="panel-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setState(current => ({ ...current, viewIndex: round.activeIndex, revealed: false }))}
          >
            Continue
          </button>
        </div>
      </Screen>
    )
  }

  if (round.phase === 'house') {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>The house plays</h1>
          <p className="tagline">The house twists below 15 and sticks on 15 or more.</p>
        </header>

        <section className="panel">
          <Hand cards={round.house} faceDown />
        </section>

        <Standings seats={seats} activeIndex={-1} />

        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={revealHouse}>
            Reveal the house
          </button>
        </div>
      </Screen>
    )
  }

  const seat = seats[round.activeIndex]
  const score = handScore(seat.cards)
  const raises = seat.betLocked ? [] : affordableRaises(seat.cash, seat.bet)

  if (!revealed) {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>Pass to {seat.name}</h1>
          <p className="tagline">Keep your cards to yourself.</p>
        </header>

        <Standings seats={seats} activeIndex={round.activeIndex} />

        <div className="panel-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setState(current => ({ ...current, revealed: true }))}
          >
            I'm {seat.name} — show my cards
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen onExit={onExit}>
      <header className="panel-header">
        <h1>{seat.name}</h1>
        <p className="tagline">Score {score}</p>
      </header>

      <section className="panel">
        <Hand cards={seat.cards} faceDown={false} />
        <p className="hint">Bet £{seat.bet} of £{seat.cash}</p>

        {raises.length > 0 && (
          <div className="bet-actions">
            <span className="bet-label">Raise:</span>
            {raises.map(amount => (
              <button
                key={amount}
                type="button"
                className="btn-secondary"
                onClick={() => setRound(raiseBet(round, amount))}
              >
                +£{amount}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="panel-actions">
        <button type="button" className="btn-primary" onClick={() => setRound(twist(round))}>
          Twist
        </button>
        <button type="button" className="btn-secondary" onClick={() => setRound(stick(round))}>
          Stick
        </button>
      </div>

      <Standings seats={seats} activeIndex={round.activeIndex} />
    </Screen>
  )
}
