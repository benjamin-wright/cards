import { colourOf } from './wheel'

export type BetKind = 'straight' | 'column' | 'dozen' | 'even-money'

export type BetSpot = {
  id: string
  label: string
  kind: BetKind
  /** Pockets that pay this spot out. */
  numbers: number[]
  /** Profit multiple on a winning stake, so £1 on a straight up returns £36. */
  payout: number
}

/** Chip denominations players stake with. */
export const CHIPS = [1, 5, 10] as const

const NUMBERS = Array.from({ length: 36 }, (_, index) => index + 1)

/**
 * The three rows of the classic board, laid out left to right in twelve
 * columns of three. The top row holds the third column bet (3, 6, 9…), the
 * bottom row the first (1, 4, 7…).
 */
export const NUMBER_ROWS: number[][] = [
  NUMBERS.filter(number => number % 3 === 0),
  NUMBERS.filter(number => number % 3 === 2),
  NUMBERS.filter(number => number % 3 === 1),
]

function straight(number: number): BetSpot {
  return {
    id: `straight-${number}`,
    label: String(number),
    kind: 'straight',
    numbers: [number],
    payout: 35,
  }
}

function column(row: number): BetSpot {
  return {
    id: `column-${row + 1}`,
    label: '2 to 1',
    kind: 'column',
    numbers: NUMBER_ROWS[row],
    payout: 2,
  }
}

function dozen(index: number): BetSpot {
  return {
    id: `dozen-${index + 1}`,
    label: `${['1st', '2nd', '3rd'][index]} 12`,
    kind: 'dozen',
    numbers: NUMBERS.slice(index * 12, index * 12 + 12),
    payout: 2,
  }
}

function evenMoney(id: string, label: string, numbers: number[]): BetSpot {
  return { id, label, kind: 'even-money', numbers, payout: 1 }
}

export const STRAIGHT_SPOTS: BetSpot[] = [0, ...NUMBERS].map(straight)

export const COLUMN_SPOTS: BetSpot[] = [0, 1, 2].map(column)

export const DOZEN_SPOTS: BetSpot[] = [0, 1, 2].map(dozen)

export const OUTSIDE_SPOTS: BetSpot[] = [
  evenMoney('low', '1 to 18', NUMBERS.slice(0, 18)),
  evenMoney('even', 'Even', NUMBERS.filter(number => number % 2 === 0)),
  evenMoney('red', 'Red', NUMBERS.filter(number => colourOf(number) === 'red')),
  evenMoney('black', 'Black', NUMBERS.filter(number => colourOf(number) === 'black')),
  evenMoney('odd', 'Odd', NUMBERS.filter(number => number % 2 === 1)),
  evenMoney('high', '19 to 36', NUMBERS.slice(18)),
]

export const BET_SPOTS: BetSpot[] = [...STRAIGHT_SPOTS, ...COLUMN_SPOTS, ...DOZEN_SPOTS, ...OUTSIDE_SPOTS]

const BY_ID = new Map(BET_SPOTS.map(spot => [spot.id, spot]))

export function betSpot(id: string): BetSpot | null {
  return BY_ID.get(id) ?? null
}

export function isBetId(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value)
}

export function wins(spot: BetSpot, pocket: number): boolean {
  return spot.numbers.includes(pocket)
}

/** Profit (or loss) on a stake once the ball has landed. */
export function betReturn(spot: BetSpot, stake: number, pocket: number): number {
  return wins(spot, pocket) ? stake * spot.payout : -stake
}
