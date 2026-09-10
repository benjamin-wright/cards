export type Rng = () => number

export type Colour = 'red' | 'black' | 'green'

/** Pocket order around a single-zero (European) wheel, clockwise from zero. */
export const WHEEL: number[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
]

export const POCKETS = WHEEL.length

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export function isPocket(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 36
}

export function colourOf(pocket: number): Colour {
  if (pocket === 0) return 'green'
  return RED_NUMBERS.has(pocket) ? 'red' : 'black'
}

/**
 * Where a pocket sits on the wheel, in degrees clockwise from zero. Used to
 * work out how far the spinner has to turn to land the result under the
 * marker.
 */
export function pocketAngle(pocket: number): number {
  const index = WHEEL.indexOf(pocket)
  return index < 0 ? 0 : (index * 360) / POCKETS
}

/** Picks the pocket the ball lands in. */
export function spinWheel(rng: Rng = Math.random): number {
  const index = Math.min(POCKETS - 1, Math.max(0, Math.floor(rng() * POCKETS)))
  return WHEEL[index]
}
