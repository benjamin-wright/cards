import { SUIT_SYMBOLS } from '../games'
import type { Card } from '../blackjack/engine'

type CardFaceProps = {
  card?: Card
  faceDown?: boolean
}

export default function CardFace({ card, faceDown = false }: CardFaceProps) {
  if (faceDown || !card) {
    return <span className="hand-card hand-card--back" aria-label="Face down card" />
  }

  const symbol = SUIT_SYMBOLS[card.suit]

  return (
    <span className={`hand-card suit-${card.suit}`} aria-label={`${card.rank} of ${card.suit}`}>
      <span className="hand-card-rank" aria-hidden="true">{card.rank}</span>
      <span className="hand-card-suit" aria-hidden="true">{symbol}</span>
    </span>
  )
}
