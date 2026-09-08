import { useState } from 'react'
import GameSelect from './views/GameSelect'
import PlayerSetup from './views/PlayerSetup'
import Blackjack from './blackjack/Blackjack'
import type { Result } from './blackjack/round'
import type { Game } from './games'
import type { Player } from './players'

function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [editingPlayers, setEditingPlayers] = useState(true)
  const [game, setGame] = useState<Game | null>(null)

  const settle = (results: Result[]) => {
    setPlayers(current =>
      current.map(player => {
        const result = results.find(entry => entry.playerId === player.id)
        return result === undefined ? player : { ...player, cash: result.cashAfter }
      }),
    )
  }

  if (editingPlayers) {
    return (
      <div id="app">
        <PlayerSetup
          players={players}
          onConfirm={confirmed => {
            setPlayers(confirmed)
            setEditingPlayers(false)
          }}
        />
      </div>
    )
  }

  return (
    <div id="app">
      {game === null ? (
        <GameSelect players={players} onSelect={setGame} onEditPlayers={() => setEditingPlayers(true)} />
      ) : game.id === 'blackjack' ? (
        <Blackjack players={players} onSettle={settle} onExit={() => setGame(null)} />
      ) : (
        <main className="view-game-placeholder">
          <h2>{game.name}</h2>
          <p>This game hasn't been built yet.</p>
          <button type="button" className="btn-primary" onClick={() => setGame(null)}>
            Back to games
          </button>
        </main>
      )}
    </div>
  )
}

export default App
