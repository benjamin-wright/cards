import { describe, expect, it } from 'vitest'
import { FLAT_LIMIT, UPRIGHT_LIMIT, nearSeat, nextPosture, screenTilt } from './orientation'

describe('screenTilt', () => {
  it('is zero when the device is level', () => {
    expect(screenTilt(0, 0)).toBeCloseTo(0)
  })

  it('is a right angle when the device is stood on an edge', () => {
    expect(screenTilt(90, 0)).toBeCloseTo(90)
    expect(screenTilt(0, 90)).toBeCloseTo(90)
  })

  it('treats face up and face down the same', () => {
    expect(screenTilt(180, 0)).toBeCloseTo(0)
  })

  it('combines both axes', () => {
    expect(screenTilt(30, 30)).toBeGreaterThan(screenTilt(30, 0))
  })
})

describe('nextPosture', () => {
  it('reads a level device as flat', () => {
    expect(nextPosture('upright', 5, -5)).toBe('flat')
  })

  it('reads a raised device as upright', () => {
    expect(nextPosture('flat', 70, 0)).toBe('upright')
  })

  it('holds the last posture between the two limits', () => {
    const between = (FLAT_LIMIT + UPRIGHT_LIMIT) / 2

    expect(nextPosture('flat', between, 0)).toBe('flat')
    expect(nextPosture('upright', between, 0)).toBe('upright')
  })
})

describe('nearSeat', () => {
  it('faces the first seat when the page is the right way up', () => {
    expect(nearSeat(0)).toBe(0)
    expect(nearSeat(90)).toBe(0)
  })

  it('faces the second seat when the device is turned around', () => {
    expect(nearSeat(180)).toBe(1)
    expect(nearSeat(270)).toBe(1)
  })
})
