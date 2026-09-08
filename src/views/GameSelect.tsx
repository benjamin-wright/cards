import { games, type Game } from '../games'
import GameCard from './GameCard'

type GameSelectProps = {
  onSelect: (game: Game) => void
}

export default function GameSelect({ onSelect }: GameSelectProps) {
  return (
    <main className="view-game-select">
      <header className="game-select-header">
        <h1>Cards</h1>
        <p className="tagline">Pick a game to play on this device</p>
      </header>

      <div className="game-grid">
        {games.map(game => (
          <GameCard key={game.id} game={game} onSelect={onSelect} />
        ))}
      </div>
    </main>
  )
}
