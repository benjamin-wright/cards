import { games, type Game } from '../games'
import type { Player } from '../players'
import GameCard from './GameCard'

type GameSelectProps = {
  players: Player[]
  onSelect: (game: Game) => void
  onEditPlayers: () => void
}

export default function GameSelect({ players, onSelect, onEditPlayers }: GameSelectProps) {
  return (
    <main className="view-game-select">
      <header className="game-select-header">
        <h1>Cards</h1>
        <p className="tagline">Pick a game to play on this device</p>
      </header>

      <div className="player-summary">
        <ul className="player-chips">
          {players.map(player => (
            <li key={player.id} className="player-chip">
              <span className="player-chip-name">{player.name}</span>
              <span className="player-chip-cash">£{player.cash}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-ghost" onClick={onEditPlayers}>
          Edit players
        </button>
      </div>

      <div className="game-grid">
        {games.map(game => (
          <GameCard key={game.id} game={game} playerCount={players.length} onSelect={onSelect} />
        ))}
      </div>
    </main>
  )
}
