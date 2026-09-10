import { POCKETS, pocketAngle } from './wheel'

/* ─── Geometry, in the wheel's own 200×200 viewBox ────────────── */
export const SIZE = 200
export const CENTRE = SIZE / 2
/** The bowl the whole thing sits in. */
export const BOWL_RADIUS = 98
/** The groove the ball runs around before it drops in. */
export const TRACK_RADIUS = 92
/** Outer edge of the turning pocket ring. */
export const RIM_RADIUS = 86
/** Where the ball comes to rest, in the middle of the numbered pockets. */
export const POCKET_RADIUS = 74
export const NUMBER_RADIUS = 57
export const HUB_RADIUS = 32
export const BALL_RADIUS = 3.6
export const POCKET_STEP = 360 / POCKETS

/* ─── Timings ─────────────────────────────────────────────────── */
/** The wheel turns slowly and never stops, clockwise, in degrees per second. */
export const WHEEL_SPEED = 24
/** The ball is thrown the other way, in degrees per second. */
export const BALL_SPEED = -520
/** Flight along the entry tangent, before the ball touches the track. */
export const APPROACH_MS = 600
/** Touchdown to matching the wheel's speed, decelerating at a constant rate. */
export const TRACK_MS = 4200
/** The tail of the track run, spent falling in towards the pockets. */
export const DROP_MS = 1400
/** How long the winning number sits on screen before the summary pops up. */
export const REST_MS = 900

/** The moment the ball settles into its pocket. */
export const LANDING_MS = APPROACH_MS + TRACK_MS
/** The whole spin, from the throw to the summary. */
export const SPIN_MS = LANDING_MS + REST_MS

const TRACK_S = TRACK_MS / 1000
const DROP_S = DROP_MS / 1000
const APPROACH_S = APPROACH_MS / 1000

/** Constant deceleration that carries the ball from its throw to wheel speed. */
const DECELERATION = (WHEEL_SPEED - BALL_SPEED) / TRACK_S

const RADIANS = Math.PI / 180

export type Point = { x: number; y: number }

export function polar(radius: number, degrees: number): Point {
  const angle = (degrees - 90) * RADIANS
  return { x: CENTRE + radius * Math.cos(angle), y: CENTRE + radius * Math.sin(angle) }
}

/**
 * Where the wheel face is pointing `elapsed` ms into the spin, having started
 * at `from` degrees. It turns at a constant crawl and is never stopped, so the
 * ball has something moving to land on.
 */
export function wheelAngle(elapsed: number, from = 0): number {
  return from + (WHEEL_SPEED * elapsed) / 1000
}

/** The ball's angular velocity `seconds` after touchdown. */
export function ballSpeed(seconds: number): number {
  return BALL_SPEED + DECELERATION * Math.min(seconds, TRACK_S)
}

/** Degrees the ball has swept round the track since touchdown. */
export function ballTravel(seconds: number): number {
  const time = Math.min(seconds, TRACK_S)
  return BALL_SPEED * time + (DECELERATION * time * time) / 2
}

/**
 * How far out the ball is running. It holds the outer groove for most of the
 * run, then falls inwards on a parabola over the last stretch — barely at
 * first, then quickly, the way a dropped ball does.
 */
export function ballRadius(seconds: number): number {
  const falling = seconds - (TRACK_S - DROP_S)
  if (falling <= 0) return TRACK_RADIUS

  const progress = Math.min(1, falling / DROP_S)
  return TRACK_RADIUS - (TRACK_RADIUS - POCKET_RADIUS) * progress * progress
}

/**
 * Where the ball has to touch down to end up in `pocket`. The spin is worked
 * backwards from the pocket's position at the moment the ball stops, so the
 * flight itself never has to be corrected part way round.
 */
export function contactAngle(pocket: number, from = 0): number {
  return wheelAngle(LANDING_MS, from) + pocketAngle(pocket) - ballTravel(TRACK_S)
}

/** Unit vector along the ball's direction of travel at `degrees` on the track. */
function heading(degrees: number): Point {
  const angle = (degrees - 90) * RADIANS
  const direction = Math.sign(BALL_SPEED)
  return { x: -direction * Math.sin(angle), y: direction * Math.cos(angle) }
}

/**
 * How far back along the entry tangent the ball starts. Easing in on a square
 * leaves the ball travelling at twice its average by the end, so this is set
 * to hand it over to the track at exactly the speed it carries on at.
 */
const ENTRY_DISTANCE = (Math.abs(BALL_SPEED) * RADIANS * TRACK_RADIUS * APPROACH_S) / 2

/**
 * The ball, `elapsed` ms into a spin that started with the wheel at `from`
 * degrees: thrown in along a tangent, a couple of circuits of the outer
 * groove while it decelerates, then a fall into the pocket as it comes down
 * to the wheel's own speed. Past the landing it simply rides round with the
 * wheel.
 */
export function ballAt(elapsed: number, pocket: number, from = 0): Point {
  if (elapsed >= LANDING_MS) {
    return polar(POCKET_RADIUS, wheelAngle(elapsed, from) + pocketAngle(pocket))
  }

  const contact = contactAngle(pocket, from)

  if (elapsed >= APPROACH_MS) {
    const seconds = (elapsed - APPROACH_MS) / 1000
    return polar(ballRadius(seconds), contact + ballTravel(seconds))
  }

  const progress = Math.max(0, elapsed) / APPROACH_MS
  const distance = ENTRY_DISTANCE * (1 - progress * progress)
  const touchdown = polar(TRACK_RADIUS, contact)
  const direction = heading(contact)

  return { x: touchdown.x - direction.x * distance, y: touchdown.y - direction.y * distance }
}
