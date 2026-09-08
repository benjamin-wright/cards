import { useState } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS, STARTING_CASH, createPlayer, displayName, type Player } from '../players'

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

  const addPlayer = () => {
    setDraft(current => (current.length >= MAX_PLAYERS ? current : [...current, createPlayer(current.length)]))
  }

  const removePlayer = (id: string) => {
    setDraft(current => (current.length <= MIN_PLAYERS ? current : current.filter(player => player.id !== id)))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(draft.map((player, index) => ({ ...player, name: displayName(player, index) })))
  }

  return (
    <main className="view-player-setup">
      <header className="panel-header">
        <h1>Who's playing?</h1>
        <p className="tagline">Everyone starts with £{STARTING_CASH}</p>
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
              <button
                type="button"
                className="btn-ghost"
                onClick={() => removePlayer(player.id)}
                disabled={draft.length <= MIN_PLAYERS}
                aria-label={`Remove player ${index + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="panel-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={addPlayer}
            disabled={draft.length >= MAX_PLAYERS}
          >
            Add player
          </button>
          <button type="submit" className="btn-primary">
            Continue
          </button>
        </div>

        <p className="hint">Between {MIN_PLAYERS} and {MAX_PLAYERS} players.</p>
      </form>
    </main>
  )
}
