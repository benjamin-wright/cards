import type { Card } from '../cards'
import { cardKey } from '../cards'
import CardFace from './CardFace'

export default function TableReveal({
  hands,
  title,
  onContinue,
  continueLabel,
  onExit,
}: {
  hands: { playerId: string; name: string; cards: Card[]; detail: string }[]
  title: string
  onContinue: () => void
  continueLabel: string
  onExit: () => void
}) {
  return (
    <div className="table-reveal" role="dialog" aria-labelledby="table-reveal-title">
      <h2 id="table-reveal-title">{title}</h2>
      {hands.map(hand => (
        <section key={hand.playerId} className="table-reveal-hand">
          <h3>{hand.name}</h3>
          <span className="hand">
            {hand.cards.map(card => <CardFace key={cardKey(card)} card={card} />)}
          </span>
          <span>{hand.detail}</span>
        </section>
      ))}
      <button type="button" className="btn-primary" onClick={onContinue}>{continueLabel}</button>
      <button type="button" className="btn-secondary" onClick={onExit}>Back to games</button>
    </div>
  )
}
