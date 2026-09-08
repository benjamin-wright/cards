import { SUIT_SYMBOLS } from '../games'
import type { Card } from '../cards'

type CardFaceProps = {
  card?: Card
  faceDown?: boolean
  /** Renders the card as a button, for hands where cards are picked. */
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  /** Extra emphasis, e.g. the card just drawn this turn. */
  highlighted?: boolean
}

export default function CardFace({
  card,
  faceDown = false,
  onClick,
  selected = false,
  disabled = false,
  highlighted = false,
}: CardFaceProps) {
  if (faceDown || !card) {
    return <span className="hand-card hand-card--back" aria-label="Face down card" />
  }

  const className = [
    'hand-card',
    `suit-${card.suit}`,
    selected ? 'hand-card--selected' : '',
    highlighted ? 'hand-card--drawn' : '',
  ]
    .filter(entry => entry !== '')
    .join(' ')

  const label = `${card.rank} of ${card.suit}`

  const contents = (
    <>
      <span className="hand-card-rank" aria-hidden="true">{card.rank}</span>
      <span className="hand-card-suit" aria-hidden="true">{SUIT_SYMBOLS[card.suit]}</span>
    </>
  )

  if (onClick === undefined) {
    return (
      <span className={className} aria-label={label}>
        {contents}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      {contents}
    </button>
  )
}
