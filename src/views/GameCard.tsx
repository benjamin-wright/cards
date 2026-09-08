import { SUIT_SYMBOLS, isPlayable, playerCountLabel, supportsPlayerCount, type Game } from '../games'

type GameCardProps = {
  game: Game
  playerCount: number
  onSelect: (game: Game) => void
}

export default function GameCard({ game, playerCount, onSelect }: GameCardProps) {
  const symbol = SUIT_SYMBOLS[game.suit]
  const fitsPlayers = supportsPlayerCount(game, playerCount)
  const playable = isPlayable(game, playerCount)

  const badge = !game.available
    ? 'Coming soon'
    : fitsPlayers
      ? null
      : `Needs ${playerCountLabel(game)}`

  return (
    <button
      type="button"
      className={`playing-card suit-${game.suit}`}
      onClick={() => onSelect(game)}
      disabled={!playable}
      aria-label={`${game.name}${badge === null ? '' : ` (${badge})`}`}
    >
      <span className="card-corner card-corner--top" aria-hidden="true">
        <span className="card-rank">{game.rank}</span>
        <span className="card-suit">{symbol}</span>
      </span>

      <span className="card-body">
        <span className="card-pip" aria-hidden="true">{symbol}</span>
        <span className="card-title">{game.name}</span>
        <span className="card-description">{game.description}</span>
        <span className="card-players">{playerCountLabel(game)}</span>
        {badge !== null && <span className="card-badge">{badge}</span>}
      </span>

      <span className="card-corner card-corner--bottom" aria-hidden="true">
        <span className="card-rank">{game.rank}</span>
        <span className="card-suit">{symbol}</span>
      </span>
    </button>
  )
}
