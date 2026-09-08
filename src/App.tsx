import { useState } from 'react'
import GameSelect from './views/GameSelect'
import type { Game } from './games'

function App() {
  const [game, setGame] = useState<Game | null>(null)

  return (
    <div id="app">
      {game === null ? (
        <GameSelect onSelect={setGame} />
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
