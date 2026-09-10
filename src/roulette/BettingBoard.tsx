import type { CSSProperties } from 'react'
import { COLUMN_SPOTS, DOZEN_SPOTS, NUMBER_ROWS, OUTSIDE_SPOTS, betSpot, type BetSpot } from './bets'
import { colourOf } from './wheel'

export type BoardStake = {
  /** Which seat the chips belong to, used to colour them. */
  seat: number
  amount: number
}

type BettingBoardProps = {
  /** Stakes on each spot, keyed by bet id. */
  stakes: Record<string, BoardStake[]>
  /** Highlights the winning spots once the ball has landed. */
  pocket: number | null
  interactive: boolean
  onPlace: (betId: string) => void
  onClear: (betId: string) => void
}

function Chips({ stakes }: { stakes: BoardStake[] }) {
  if (stakes.length === 0) return null

  return (
    <span className="bet-chips">
      {stakes.map(stake => (
        <span key={stake.seat} className={`bet-chip bet-chip--seat-${stake.seat + 1}`}>
          {stake.amount}
        </span>
      ))}
    </span>
  )
}

function Spot({
  spot,
  className,
  style,
  stakes,
  winning,
  interactive,
  onPlace,
  onClear,
}: {
  spot: BetSpot
  className: string
  style?: CSSProperties
  stakes: BoardStake[]
  winning: boolean
  interactive: boolean
  onPlace: (betId: string) => void
  onClear: (betId: string) => void
}) {
  return (
    <button
      type="button"
      className={`${className}${winning ? ' board-spot--winner' : ''}`}
      style={style}
      disabled={!interactive}
      aria-label={`${spot.label} — pays ${spot.payout} to 1`}
      onClick={() => onPlace(spot.id)}
      onContextMenu={event => {
        event.preventDefault()
        onClear(spot.id)
      }}
    >
      <span className="board-spot-label">{spot.label}</span>
      <Chips stakes={stakes} />
    </button>
  )
}

/**
 * The classic single-zero layout: zero down the left, three rows of twelve
 * numbers with the column bets on the right, then the dozens and the even
 * money bets underneath. Tapping a spot adds a chip, long-press style
 * right-click (or the Clear button) takes the stake back off.
 */
export default function BettingBoard({ stakes, pocket, interactive, onPlace, onClear }: BettingBoardProps) {
  const spotProps = (spot: BetSpot) => ({
    spot,
    stakes: stakes[spot.id] ?? [],
    winning: pocket !== null && spot.numbers.includes(pocket),
    interactive,
    onPlace,
    onClear,
  })

  const zero = betSpot('straight-0')!

  return (
    <div className="roulette-board">
      <Spot
        {...spotProps(zero)}
        className="board-spot board-spot--zero colour-green"
        style={{ gridColumn: 1, gridRow: '1 / span 3' }}
      />

      {NUMBER_ROWS.map((row, rowIndex) =>
        row.map((number, columnIndex) => (
          <Spot
            key={number}
            {...spotProps(betSpot(`straight-${number}`)!)}
            className={`board-spot board-spot--number colour-${colourOf(number)}`}
            style={{ gridColumn: columnIndex + 2, gridRow: rowIndex + 1 }}
          />
        )),
      )}

      {COLUMN_SPOTS.map((spot, rowIndex) => (
        <Spot
          key={spot.id}
          {...spotProps(spot)}
          className="board-spot board-spot--outside"
          style={{ gridColumn: 14, gridRow: rowIndex + 1 }}
        />
      ))}

      {DOZEN_SPOTS.map((spot, index) => (
        <Spot
          key={spot.id}
          {...spotProps(spot)}
          className="board-spot board-spot--outside"
          style={{ gridColumn: `${index * 4 + 2} / span 4`, gridRow: 4 }}
        />
      ))}

      {OUTSIDE_SPOTS.map((spot, index) => (
        <Spot
          key={spot.id}
          {...spotProps(spot)}
          className="board-spot board-spot--outside"
          style={{ gridColumn: `${index * 2 + 2} / span 2`, gridRow: 5 }}
        />
      ))}
    </div>
  )
}
