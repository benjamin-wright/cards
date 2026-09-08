import { useState } from 'react'
import { STARTING_CASH, createPlayer, displayName, resetCash, type Player } from '../players'

type PlayerSetupProps = {
  players: Player[]
  onConfirm: (players: Player[]) => void
}

export default function PlayerSetup({ players, onConfirm }: PlayerSetupProps) {
  const [draft, setDraft] = useState<Player[]>(
    players.length > 0 ? players : [createPlayer(0), createPlayer(1)],
  )

  const rename = (id: string, name: string) => {
    setDraft(current => current.map(player => (player.id === id ? { ...player, name } : player)))
  }

  const resetTotals = () => {
    setDraft(current => resetCash(current))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(draft.map((player, index) => ({ ...player, name: displayName(player, index) })))
  }

  return (
    <main className="view-player-setup">
      <header className="panel-header">
        <h1>Who's playing?</h1>
        <p className="tagline">Two players, £{STARTING_CASH} each, sat across the table</p>
      </header>

      <form className="panel" onSubmit={submit}>
        <ul className="player-list">
          {draft.map((player, index) => (
            <li key={player.id} className="player-row">
              <label className="visually-hidden" htmlFor={`name-${player.id}`}>
                Player {index + 1} name
              </label>
              <input
                id={`name-${player.id}`}
                type="text"
                value={player.name}
                maxLength={16}
                placeholder={`Player ${index + 1}`}
                onChange={event => rename(player.id, event.target.value)}
              />
              <span className="player-row-cash">£{player.cash}</span>
            </li>
          ))}
        </ul>

        <div className="panel-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={resetTotals}
            disabled={draft.every(player => player.cash === STARTING_CASH)}
          >
            Reset cash
          </button>
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </div>
      </form>
    </main>
  )
}
