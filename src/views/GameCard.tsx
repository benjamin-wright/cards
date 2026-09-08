import { SUIT_SYMBOLS, type Game } from '../games'

type GameCardProps = {
  game: Game
  onSelect: (game: Game) => void
}

export default function GameCard({ game, onSelect }: GameCardProps) {
  const symbol = SUIT_SYMBOLS[game.suit]

  return (
    <button
      type="button"
      className={`playing-card suit-${game.suit}`}
      onClick={() => onSelect(game)}
      disabled={!game.available}
      aria-label={`${game.name}${game.available ? '' : ' (coming soon)'}`}
    >
      <span className="card-corner card-corner--top" aria-hidden="true">
        <span className="card-rank">{game.rank}</span>
        <span className="card-suit">{symbol}</span>
      </span>

      <span className="card-body">
        <span className="card-pip" aria-hidden="true">{symbol}</span>
        <span className="card-title">{game.name}</span>
        <span className="card-description">{game.description}</span>
        <span className="card-players">{game.players}</span>
        {!game.available && <span className="card-badge">Coming soon</span>}
      </span>

      <span className="card-corner card-corner--bottom" aria-hidden="true">
        <span className="card-rank">{game.rank}</span>
        <span className="card-suit">{symbol}</span>
      </span>
    </button>
  )
}
