import type { Result } from './round'
import { colourOf } from './wheel'

type SpinSummaryProps = {
  pocket: number
  results: Result[]
  /** Null when nobody can cover another spin, leaving the final balances. */
  onNext: (() => void) | null
  onExit: () => void
}

function money(amount: number): string {
  return `${amount < 0 ? '-' : '+'}£${Math.abs(amount)}`
}

/** Winnings and losses for both players, once the wheel has stopped. */
export default function SpinSummary({ pocket, results, onNext, onExit }: SpinSummaryProps) {
  return (
    <div className="score-popup-backdrop" role="dialog" aria-modal="true" aria-label="Spin result">
      <div className="score-popup">
        <header className="score-popup-header">
          <h2>
            The ball landed on <span className={`roulette-result colour-${colourOf(pocket)}`}>{pocket}</span>
          </h2>
        </header>

        <div className="score-popup-items">
          {results.map(result => (
            <div key={result.playerId} className="score-popup-item">
              <div className="score-popup-item-header">
                <span className="score-popup-item-name">{result.name}</span>
                <span className={`score-popup-item-points${result.delta < 0 ? ' score-popup-item-points--loss' : ''}`}>
                  {money(result.delta)}
                </span>
              </div>
              <div className="roulette-summary-bets">
                {result.bets.length === 0 ? (
                  <span className="hint">No bets placed</span>
                ) : (
                  result.bets.map(bet => (
                    <span key={bet.betId} className={`roulette-summary-bet${bet.won ? ' roulette-summary-bet--won' : ''}`}>
                      {bet.label} £{bet.stake} {money(bet.delta)}
                    </span>
                  ))
                )}
              </div>
              <span className="hint">
                Staked £{result.staked} — total £{result.cashAfter}
              </span>
            </div>
          ))}
        </div>

        {onNext === null && <p className="hint">Nobody can cover another bet — those are the final totals.</p>}

        <footer className="score-popup-footer">
          <button type="button" className="btn-secondary" onClick={onExit}>
            Back to games
          </button>
          {onNext !== null && (
            <button type="button" className="btn-primary" onClick={onNext}>
              Next spin
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
