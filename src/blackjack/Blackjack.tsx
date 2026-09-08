import { useState } from 'react'
import type { Player } from '../players'
import { MIN_PLAYERS } from '../players'
import { ANTE, affordableRaises, handScore, type Card } from './engine'
import {
  canAnte,
  createRound,
  finishRound,
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

export default function Blackjack({ players, onSettle, onExit }: BlackjackProps) {
  const [round, setRound] = useState<Round | null>(() => {
    const able = players.filter(canAnte)
    return able.length >= MIN_PLAYERS ? createRound(able) : null
  })
  const [viewIndex, setViewIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const deal = () => {
    const able = players.filter(canAnte)
    setRound(able.length >= MIN_PLAYERS ? createRound(able) : null)
    setViewIndex(0)
    setRevealed(false)
  }

  if (round === null) {
    return (
      <main className="view-blackjack">
        <header className="panel-header">
          <h1>Blackjack</h1>
          <p className="tagline">
            At least {MIN_PLAYERS} players need £{ANTE} to cover the entry fee.
          </p>
        </header>
        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </main>
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
      <main className="view-blackjack">
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
          <button type="button" className="btn-primary" onClick={deal}>
            Play another hand
          </button>
          <button type="button" className="btn-secondary" onClick={onExit}>
            Back to games
          </button>
        </div>
      </main>
    )
  }

  if (turnOver && finishedSeat) {
    return (
      <main className="view-blackjack">
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
            onClick={() => {
              setViewIndex(round.activeIndex)
              setRevealed(false)
            }}
          >
            Continue
          </button>
        </div>
      </main>
    )
  }

  if (round.phase === 'house') {
    return (
      <main className="view-blackjack">
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
      </main>
    )
  }

  const seat = seats[round.activeIndex]
  const score = handScore(seat.cards)
  const raises = seat.raised ? [] : affordableRaises(seat.cash, seat.bet)

  if (!revealed) {
    return (
      <main className="view-blackjack">
        <header className="panel-header">
          <h1>Pass to {seat.name}</h1>
          <p className="tagline">Keep your cards to yourself.</p>
        </header>

        <Standings seats={seats} activeIndex={round.activeIndex} />

        <div className="panel-actions">
          <button type="button" className="btn-primary" onClick={() => setRevealed(true)}>
            I'm {seat.name} — show my cards
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="view-blackjack">
      <header className="panel-header">
        <h1>{seat.name}</h1>
        <p className="tagline">Score {score}</p>
      </header>

      <section className="panel">
        <Hand cards={seat.cards} faceDown={false} />
        <p className="hint">Bet £{seat.bet} of £{seat.cash}</p>

        {raises.length > 0 && (
          <div className="bet-actions">
            <span className="bet-label">Raise once:</span>
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
    </main>
  )
}
