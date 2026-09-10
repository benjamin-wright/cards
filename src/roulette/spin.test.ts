import { describe, expect, it } from 'vitest'
import {
  APPROACH_MS,
  BALL_SPEED,
  CENTRE,
  LANDING_MS,
  POCKET_RADIUS,
  SPIN_MS,
  TRACK_MS,
  TRACK_RADIUS,
  WHEEL_SPEED,
  ballAt,
  ballRadius,
  ballSpeed,
  ballTravel,
  polar,
  wheelAngle,
} from './spin'
import { WHEEL, pocketAngle } from './wheel'

const TRACK_S = TRACK_MS / 1000

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function radius(point: { x: number; y: number }): number {
  return Math.hypot(point.x - CENTRE, point.y - CENTRE)
}

describe('wheel motion', () => {
  it('turns slowly and never stops', () => {
    expect(wheelAngle(0)).toBe(0)
    expect(wheelAngle(1000)).toBe(WHEEL_SPEED)
    expect(wheelAngle(1000, 90)).toBe(90 + WHEEL_SPEED)
    expect(wheelAngle(SPIN_MS * 10)).toBeGreaterThan(wheelAngle(SPIN_MS))
  })
})

describe('ball motion', () => {
  it('is thrown against the wheel and decelerates onto its speed', () => {
    expect(ballSpeed(0)).toBe(BALL_SPEED)
    expect(Math.sign(BALL_SPEED)).toBe(-Math.sign(WHEEL_SPEED))
    expect(ballSpeed(TRACK_S)).toBeCloseTo(WHEEL_SPEED)

    // Constant deceleration: equal steps take equal bites out of the speed.
    const first = ballSpeed(1) - ballSpeed(0)
    const last = ballSpeed(TRACK_S) - ballSpeed(TRACK_S - 1)
    expect(first).toBeCloseTo(last)
  })

  it('makes a couple of circuits of the track', () => {
    const circuits = Math.abs(ballTravel(TRACK_S)) / 360
    expect(circuits).toBeGreaterThan(2)
    expect(circuits).toBeLessThan(4)
  })

  it('holds the outer groove before falling in on a parabola', () => {
    expect(ballRadius(0)).toBe(TRACK_RADIUS)
    expect(ballRadius(TRACK_S / 2)).toBe(TRACK_RADIUS)
    expect(ballRadius(TRACK_S)).toBeCloseTo(POCKET_RADIUS)

    // Falls slowly at first, then faster — never outwards.
    let previous = TRACK_RADIUS
    let steepest = 0
    for (let step = 1; step <= 40; step += 1) {
      const current = ballRadius((TRACK_S * step) / 40)
      const drop = previous - current
      expect(current).toBeLessThanOrEqual(previous)
      expect(drop).toBeGreaterThanOrEqual(steepest - 1e-9)
      steepest = drop
      previous = current
    }
  })

  it('flies in along a tangent and touches down on the track', () => {
    const touchdown = ballAt(APPROACH_MS, 17)
    expect(radius(touchdown)).toBeCloseTo(TRACK_RADIUS)

    // It starts well outside the bowl and closes on the touchdown point.
    const thrown = ballAt(0, 17)
    expect(radius(thrown)).toBeGreaterThan(TRACK_RADIUS)
    expect(distance(ballAt(0, 17), touchdown)).toBeGreaterThan(distance(ballAt(APPROACH_MS / 2, 17), touchdown))

    // The entry line is straight: the halfway point sits on it.
    const start = ballAt(0, 17)
    const middle = ballAt(APPROACH_MS / 2, 17)
    const along = distance(start, middle) + distance(middle, touchdown)
    expect(along).toBeCloseTo(distance(start, touchdown))
  })

  it('lands in the winning pocket, wherever the wheel started', () => {
    for (const pocket of [0, 17, 26, WHEEL[10]]) {
      for (const from of [0, 137.5, -40]) {
        const landed = ballAt(LANDING_MS, pocket, from)
        const seat = polar(POCKET_RADIUS, wheelAngle(LANDING_MS, from) + pocketAngle(pocket))
        expect(distance(landed, seat)).toBeLessThan(1e-6)
      }
    }
  })

  it('runs unbroken from the throw to the pocket', () => {
    let previous = ballAt(0, 26)
    for (let elapsed = 20; elapsed <= LANDING_MS; elapsed += 20) {
      const current = ballAt(elapsed, 26)
      // No jumps: a 20ms step can't cross more than a slice of the wheel.
      expect(distance(previous, current)).toBeLessThan(30)
      previous = current
    }
  })

  it('rides round with the wheel once it has settled', () => {
    const settled = ballAt(LANDING_MS, 26)
    const later = ballAt(SPIN_MS, 26)
    expect(radius(settled)).toBeCloseTo(POCKET_RADIUS)
    expect(radius(later)).toBeCloseTo(POCKET_RADIUS)
    expect(distance(settled, later)).toBeGreaterThan(0)
    expect(distance(later, polar(POCKET_RADIUS, wheelAngle(SPIN_MS) + pocketAngle(26)))).toBeLessThan(1e-6)
  })
})
