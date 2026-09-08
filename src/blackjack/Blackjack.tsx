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
}

function isBlackjackState(value: unknown): value is BlackjackState {
  const state = value as Partial<BlackjackState>
  return typeof value === 'object' && value !== null && (state.round === null || isRound(state.round))
}

function Screen({
  onExit,
  table = false,
  children,
}: {
  onExit: () => void
  table?: boolean
  children: ReactNode
}) {
  return (
    <main className={`view-blackjack${table ? ' view-blackjack--table' : ''}`}>
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

function seatMessage(seat: Seat, result: Result | null): string {
  if (result !== null) {
    const outcome = result.outcome === 'win' ? 'Won' : result.outcome === 'lose' ? 'Lost' : 'Draw'
    const delta = result.delta === 0 ? '£0' : `${result.delta > 0 ? '+' : '-'}£${Math.abs(result.delta)}`
    return `${outcome} ${delta}`
  }
  if (seat.status === 'bust') return `Bust on ${handScore(seat.cards)}`
  if (seat.status === 'stood') return `Stuck on ${handScore(seat.cards)}`
  return `Score ${handScore(seat.cards)}`
}

function SeatPanel({
  seat,
  playable,
  result,
  onTwist,
  onStick,
  onRaise,
}: {
  seat: Seat
  playable: boolean
  result: Result | null
  onTwist: () => void
  onStick: () => void
  onRaise: (amount: number) => void
}) {
  const raises = playable && !seat.betLocked ? affordableRaises(seat.cash, seat.bet) : []

  return (
    <section className={`seat-panel${result === null ? '' : ` seat-panel--${result.outcome}`}`}>
      <header className="seat-panel-header">
        <h2>{seat.name}</h2>
        <span className="seat-panel-status">{seatMessage(seat, result)}</span>
      </header>

      <Hand cards={seat.cards} faceDown={false} />

      {result === null ? (
        <>
          <p className="hint">Bet £{seat.bet} of £{seat.cash}</p>

          {raises.length > 0 && (
            <div className="bet-actions">
              <span className="bet-label">Raise:</span>
              {raises.map(amount => (
                <button key={amount} type="button" className="btn-secondary" onClick={() => onRaise(amount)}>
                  +£{amount}
                </button>
              ))}
            </div>
          )}

          <div className="panel-actions">
            <button type="button" className="btn-primary" disabled={!playable} onClick={onTwist}>
              Twist
            </button>
            <button type="button" className="btn-secondary" disabled={!playable} onClick={onStick}>
              Stick
            </button>
          </div>
        </>
      ) : (
        <p className="hint">
          Bet £{result.bet} — Total £{result.cashAfter}
        </p>
      )}
    </section>
  )
}

function deal(players: Player[]): BlackjackState {
  const able = players.filter(canAnte)
  return {
    round: able.length >= MIN_PLAYERS ? createRound(able) : null,
  }
}

export default function Blackjack({ players, onSettle, onExit }: BlackjackProps) {
  const [state, setState] = usePersistentState<BlackjackState>(
    STORAGE_KEYS.blackjack,
    () => deal(players),
    isBlackjackState,
  )

  const { round } = state
  const setRound = (next: Round) => setState(current => ({ ...current, round: next }))

  if (round === null) {
    return (
      <Screen onExit={onExit}>
        <header className="panel-header">
          <h1>Not enough players</h1>
          <p className="tagline">
            Both players need £{ANTE} to cover the entry fee.
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
  const [bottom, top] = seats
  const results = round.results

  const revealHouse = () => {
    const settled = finishRound(round)
    setRound(settled)
    if (settled.results !== null) {
      onSettle(settled.results)
    }
  }

  const resultFor = (playerId: string): Result | null =>
    results === null ? null : results.find(entry => entry.playerId === playerId) ?? null

  // Both seats play simultaneously: the house waits until both have stood or
  // gone bust, then it plays itself out. The same table layout is reused for
  // the summary so revealing the house doesn't jump to a different screen.
  return (
    <Screen onExit={onExit} table>
      <div className="table">
        <div className="seat-area seat-area--top">
          <SeatPanel
            seat={top}
            playable={round.phase === 'player' && top.status === 'playing'}
            result={resultFor(top.playerId)}
            onTwist={() => setRound(twist(round, top.playerId))}
            onStick={() => setRound(stick(round, top.playerId))}
            onRaise={amount => setRound(raiseBet(round, top.playerId, amount))}
          />
        </div>

        <div className="house-area">
          <h2>House{round.phase === 'summary' ? ` — ${handScore(round.house)}` : ''}</h2>
          <Hand cards={round.house} faceDown={round.phase === 'player'} />
          {round.phase === 'house' && (
            <button type="button" className="btn-primary" onClick={revealHouse}>
              Reveal the house
            </button>
          )}
          {round.phase === 'player' && <p className="hint">Waiting for both players to finish</p>}
          {round.phase === 'summary' && (
            <div className="panel-actions">
              <button type="button" className="btn-primary" onClick={() => setState(deal(players))}>
                Play another hand
              </button>
              <button type="button" className="btn-secondary" onClick={onExit}>
                Back to games
              </button>
            </div>
          )}
        </div>

        <div className="seat-area seat-area--bottom">
          <SeatPanel
            seat={bottom}
            playable={round.phase === 'player' && bottom.status === 'playing'}
            result={resultFor(bottom.playerId)}
            onTwist={() => setRound(twist(round, bottom.playerId))}
            onStick={() => setRound(stick(round, bottom.playerId))}
            onRaise={amount => setRound(raiseBet(round, bottom.playerId, amount))}
          />
        </div>
      </div>
    </Screen>
  )
}
