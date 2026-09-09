import type { Card } from '../cards'
import { cardKey } from '../cards'
import CardFace from '../views/CardFace'
import type { HandScoreResult, ScoreDetail } from './scoring'

const KIND_LABELS: Record<ScoreDetail['kind'], string> = {
  fifteen: '15s',
  pair: 'Pairs',
  run: 'Run',
  flush: 'Flush',
  nobs: 'His Nobs',
}

type ScorePopupProps = {
  title: string
  starter: Card
  hand: Card[]
  result: HandScoreResult
  onContinue: () => void
  continueLabel?: string
}

export default function ScorePopup({
  title,
  starter,
  hand,
  result,
  onContinue,
  continueLabel = 'Continue',
}: ScorePopupProps) {
  return (
    <div className="score-popup-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="score-popup">
        <header className="score-popup-header">
          <h2>{title}</h2>
        </header>

        <div className="score-popup-cards">
          <div className="score-popup-group">
            <span className="pile-label">Starter</span>
            <span className="hand">
              <CardFace card={starter} />
            </span>
          </div>
          <div className="score-popup-group">
            <span className="pile-label">Hand</span>
            <span className="hand">
              {hand.map(card => (
                <CardFace key={cardKey(card)} card={card} />
              ))}
            </span>
          </div>
        </div>

        <div className="score-popup-items">
          {result.details.length === 0 ? (
            <div className="score-popup-item">
              <span className="score-popup-item-name">No points</span>
            </div>
          ) : (
            result.details.map((detail, detailIndex) => (
              <div key={`${detail.kind}-${detailIndex}`} className="score-popup-item">
                <div className="score-popup-item-header">
                  <span className="score-popup-item-name">{KIND_LABELS[detail.kind]}</span>
                  <span className="score-popup-item-points">+{detail.points}</span>
                </div>
                <div className="score-popup-item-groups">
                  {detail.cardGroups.map((group, groupIndex) => (
                    <span key={groupIndex} className="hand score-popup-item-group">
                      {group.map((card, cardIndex) => (
                        <CardFace key={`${cardKey(card)}-${cardIndex}`} card={card} />
                      ))}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <footer className="score-popup-footer">
          <span className="score-popup-total">Total: {result.totalPoints} pts</span>
          <button type="button" className="btn-primary" onClick={onContinue}>
            {continueLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
