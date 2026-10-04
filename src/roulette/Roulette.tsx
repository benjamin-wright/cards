import { useEffect, useState, type ReactNode } from 'react'
import type { Player } from '../players'
import type { Tilt } from '../orientation'
import { STORAGE_KEYS, usePersistentState } from '../storage'
import RotatedSeat from '../views/RotatedSeat'
import BettingBoard, { type BoardStake } from './BettingBoard'
import SpinSummary from './SpinSummary'
import Wheel from './Wheel'
import { SPIN_MS } from './spin'
import { CHIPS, betSpot } from './bets'
import { colourOf } from './wheel'
import {
  clearBets,
  createRound,
  endTurn,
  finishSpin,
  isRound,
  nextRound,
  placeChip,
  remaining,
  staked,
  startSpin,
  clearBet,
  type Result,
  type Round,
  type Seat,
} from './round'

/** The smallest chip, so a player needs at least this much to join a spin. */
const MIN_STAKE = CHIPS[0]

type RouletteProps = {
  players: Player[]
  onSettle: (results: Result[]) => void
  onExit: () => void
}

type RouletteState = {
  round: Round
}

function isRouletteState(value: unknown): value is RouletteState {
  const state = value as Partial<RouletteState>
  return typeof value === 'object' && value !== null && isRound(state.round)
}

function GameBar({ onExit, children }: { onExit: () => void; children?: ReactNode }) {
  return (
    <div className="game-bar">
      <span className="game-bar-title">Roulette</span>
      {children}
      <button type="button" className="btn-ghost" onClick={onExit}>
        Exit
      </button>
    </div>
  )
}

function BetSummary({ seats }: { seats: Seat[] }) {
  return (
    <div className="roulette-bet-summary">
      {seats.map((seat, index) => (
        <section key={seat.playerId} className={`roulette-bet-summary-seat roulette-bet-summary-seat--${index + 1}`}>
          <header className="seat-panel-header">
            <h2>{seat.name}</h2>
            <span className="seat-panel-status">£{staked(seat)} staked</span>
          </header>
          <div className="roulette-summary-bets">
            {Object.entries(seat.bets).length === 0 ? (
              <span className="hint">No bets placed</span>
            ) : (
              Object.entries(seat.bets).map(([betId, stake]) => (
                <span key={betId} className="roulette-summary-bet">
                  {betSpot(betId)?.label ?? betId} £{stake}
                </span>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

export default function Roulette({ players, tilt, onSettle, onExit }: RouletteProps & { tilt: Tilt }) {
  const [state, setState] = usePersistentState<RouletteState>(
    STORAGE_KEYS.roulette,
    () => ({ round: createRound(players) }),
    isRouletteState,
  )
  const [chip, setChip] = useState<number>(CHIPS[0])

  const { round } = state
  const setRound = (next: Round) => setState({ round: next })

  // The wheel is given time to come to rest before the bets are settled. The
  // winning pocket is already fixed, so a refresh mid-spin picks up where it
  // left off rather than re-rolling the ball.
  useEffect(() => {
    if (round.phase !== 'spinning') return

    const timer = setTimeout(() => setState(current => ({ round: finishSpin(current.round) })), SPIN_MS)
    return () => clearTimeout(timer)
  }, [round.phase, setState])

  // Results carry the cash each player ends on rather than a delta, so
  // re-applying them after a refresh leaves the same totals.
  const results = round.results
  useEffect(() => {
    if (round.phase === 'summary' && results !== null) {
      onSettle(results)
    }
  }, [round.phase, results, onSettle])

  // Everyone needs to be able to cover the smallest chip for another spin.
  // The check waits until the betting phase so the summary of the spin that
  // cleaned somebody out is still shown, final balances and all.
  const canPlayAgain = players.every(player => player.cash >= MIN_STAKE)

  if (round.phase === 'betting' && !canPlayAgain) {
    return (
      <main className="view-roulette">
        <GameBar onExit={onExit} />
        <header className="panel-header">
          <h1>Out of cash</h1>
          <p className="tagline">Both players need at least £{MIN_STAKE} to place a bet.</p>
        </header>
        <ul className="player-chips">
          {players.map(player => (
            <li key={player.id} className="player-chip">
              <span className="player-chip-name">{player.name}</span>
              <span className="player-chip-cash">£{player.cash}</span>
            </li>
          ))}
        </ul>
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </main>
    )
  }

  const stakes: Record<string, BoardStake[]> = {}
  round.seats.forEach((seat, index) => {
    if (round.phase === 'betting' && index !== round.turn) return
    for (const [betId, amount] of Object.entries(seat.bets)) {
      stakes[betId] = [...(stakes[betId] ?? []), { seat: index, amount }]
    }
  })

  const betting = round.phase === 'betting'
  // The seat stays on the last player to bet once the wheel is going, so the
  // board can fade out still showing the chips they laid down.
  const seat = round.seats[round.turn]
  const turn = round.turn
  // One player sits to the left of the device, the other to the right, so the
  // board is turned a quarter turn towards whoever is betting.
  const degrees = turn === 0 ? 90 : -90
  const facing = tilt === 'left' ? 0 : tilt === 'right' ? 1 : null
  const active = betting && facing === turn
  const free = remaining(seat)
  // The wheel stays mounted behind every phase while the board and spin panel
  // cross-fade; it shifts aside only while a player's betting seat is open.
  return (
    <main className={`view-roulette view-roulette--table${betting ? (active ? ` view-roulette--${tilt}` : ' view-roulette--flat') : ' view-roulette--spinning'}`}>
      <div className="roulette-stage" aria-hidden="true">
        <Wheel pocket={round.pocket} spinning={round.phase === 'spinning'} />
      </div>

      <div className="roulette-layer roulette-layer--board" aria-hidden={!betting}>
        <div className="roulette-table">
          <RotatedSeat degrees={degrees} revealed={active}>
            <section className="roulette-seat">
              <header className="roulette-seat-header">
                <h2>{seat.name}</h2>
                <span className="seat-panel-status">
                  £{free} left of £{seat.cash}
                </span>

                <div className="bet-actions">
                  {CHIPS.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      className={`bet-chip-button${chip === amount ? ' bet-chip-button--selected' : ''}`}
                      disabled={!active}
                      onClick={() => setChip(amount)}
                    >
                      £{amount}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!active || staked(seat) === 0}
                  onClick={() => setRound(clearBets(round, seat.playerId))}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!active}
                  onClick={() => setRound(endTurn(round, seat.playerId))}
                >
                  Done
                </button>
              </header>

              {active ? (
                <p className="hint">
                  Tap a spot to add a £{chip} chip{free < chip ? ' — not enough cash left' : ''}, press and hold to take
                  the stake back off.
                </p>
              ) : (
                <p className="hint">Tip the device towards {seat.name} to place their bets</p>
              )}

              <BettingBoard
                stakes={stakes}
                pocket={null}
                interactive={active}
                onPlace={betId => setRound(placeChip(round, seat.playerId, betId, chip))}
                onClear={betId => setRound(clearBet(round, seat.playerId, betId))}
              />
            </section>
          </RotatedSeat>

          <button type="button" className="btn-ghost roulette-exit" onClick={onExit}>
            Exit
          </button>
          <div className="rummy-centre">
            <span className="pile-label">
              {seat.name} betting ({round.seats.filter(entry => entry.done).length + 1} of {round.seats.length})
            </span>
          </div>
        </div>
      </div>

      <div className="roulette-layer roulette-layer--spin" aria-hidden={betting}>
        <GameBar onExit={onExit} />

        <div className="roulette-wheel-result">
          {round.phase === 'ready' ? (
            <button type="button" className="btn-primary" disabled={tilt !== 'flat'} onClick={() => setRound(startSpin(round))}>
              Spin
            </button>
          ) : round.phase === 'spinning' || round.pocket === null ? (
            <span className="hint">Spinning…</span>
          ) : (
            <span className={`roulette-result colour-${colourOf(round.pocket)}`}>{round.pocket}</span>
          )}
        </div>

        {round.phase !== 'ready' && <BetSummary seats={round.seats} />}
      </div>

      {round.phase === 'summary' && results !== null && round.pocket !== null && (
        <SpinSummary
          pocket={round.pocket}
          results={results}
          onNext={canPlayAgain ? () => setRound(nextRound(round, players)) : null}
          onExit={onExit}
        />
      )}
      {round.phase !== 'betting' && tilt !== 'flat' && (
        <div className="roulette-flat-cover">Set the phone flat to see the spin and results</div>
      )}
    </main>
  )
}
