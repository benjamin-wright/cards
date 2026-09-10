import { describe, expect, it } from 'vitest'
import { BET_SPOTS, DOZEN_SPOTS, NUMBER_ROWS, OUTSIDE_SPOTS, betReturn, betSpot, isBetId, wins } from './bets'
import { POCKETS, WHEEL, colourOf, isPocket, pocketAngle, spinWheel } from './wheel'

describe('wheel', () => {
  it('has every single-zero pocket exactly once', () => {
    expect(POCKETS).toBe(37)
    expect(new Set(WHEEL).size).toBe(37)
    for (let pocket = 0; pocket <= 36; pocket += 1) {
      expect(WHEEL).toContain(pocket)
    }
  })

  it('colours zero green and splits the rest evenly', () => {
    expect(colourOf(0)).toBe('green')
    const reds = WHEEL.filter(pocket => colourOf(pocket) === 'red')
    const blacks = WHEEL.filter(pocket => colourOf(pocket) === 'black')
    expect(reds).toHaveLength(18)
    expect(blacks).toHaveLength(18)
  })

  it('spaces the pockets evenly around the wheel', () => {
    expect(pocketAngle(0)).toBe(0)
    expect(pocketAngle(WHEEL[1])).toBeCloseTo(360 / POCKETS)
  })

  it('picks a pocket from the wheel', () => {
    expect(spinWheel(() => 0)).toBe(WHEEL[0])
    expect(spinWheel(() => 0.999999)).toBe(WHEEL[POCKETS - 1])
    // A degenerate rng that returns 1 must still land on the board.
    expect(isPocket(spinWheel(() => 1))).toBe(true)
  })

  it('rejects numbers that aren\'t pockets', () => {
    expect(isPocket(37)).toBe(false)
    expect(isPocket(-1)).toBe(false)
    expect(isPocket('3')).toBe(false)
  })
})

describe('bets', () => {
  it('has unique ids', () => {
    const ids = BET_SPOTS.map(spot => spot.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(isBetId('straight-0')).toBe(true)
    expect(isBetId('straight-37')).toBe(false)
  })

  it('lays the board out in three rows of twelve', () => {
    expect(NUMBER_ROWS.map(row => row.length)).toEqual([12, 12, 12])
    expect(NUMBER_ROWS[0].slice(0, 3)).toEqual([3, 6, 9])
    expect(NUMBER_ROWS[2].slice(0, 3)).toEqual([1, 4, 7])
    expect(NUMBER_ROWS.flat()).toHaveLength(36)
  })

  it('pays a straight up at 35 to 1', () => {
    const spot = betSpot('straight-17')!
    expect(betReturn(spot, 10, 17)).toBe(350)
    expect(betReturn(spot, 10, 18)).toBe(-10)
  })

  it('pays columns and dozens at 2 to 1', () => {
    const column = betSpot('column-1')!
    expect(wins(column, 3)).toBe(true)
    expect(wins(column, 2)).toBe(false)
    expect(betReturn(column, 5, 36)).toBe(10)

    const dozen = DOZEN_SPOTS[1]
    expect(dozen.numbers).toContain(13)
    expect(dozen.numbers).not.toContain(12)
    expect(betReturn(dozen, 5, 24)).toBe(10)
  })

  it('pays the outside bets at evens and loses them all on zero', () => {
    for (const spot of OUTSIDE_SPOTS) {
      expect(spot.numbers).toHaveLength(18)
      expect(wins(spot, 0)).toBe(false)
      expect(betReturn(spot, 5, 0)).toBe(-5)
    }

    expect(betReturn(betSpot('red')!, 5, 3)).toBe(5)
    expect(betReturn(betSpot('black')!, 5, 3)).toBe(-5)
    expect(betReturn(betSpot('odd')!, 5, 3)).toBe(5)
    expect(betReturn(betSpot('low')!, 5, 19)).toBe(-5)
    expect(betReturn(betSpot('high')!, 5, 19)).toBe(5)
  })

  it('returns null for an unknown spot', () => {
    expect(betSpot('nonsense')).toBeNull()
  })
})
