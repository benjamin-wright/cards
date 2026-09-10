import { useEffect, useRef } from 'react'
import {
  BALL_RADIUS,
  BOWL_RADIUS,
  CENTRE,
  HUB_RADIUS,
  LANDING_MS,
  NUMBER_RADIUS,
  POCKET_STEP,
  RIM_RADIUS,
  SIZE,
  TRACK_RADIUS,
  ballAt,
  polar,
  wheelAngle,
} from './spin'
import { WHEEL, colourOf } from './wheel'

function wedge(index: number): string {
  const start = polar(RIM_RADIUS, index * POCKET_STEP - POCKET_STEP / 2)
  const end = polar(RIM_RADIUS, index * POCKET_STEP + POCKET_STEP / 2)
  return `M ${CENTRE} ${CENTRE} L ${start.x} ${start.y} A ${RIM_RADIUS} ${RIM_RADIUS} 0 0 1 ${end.x} ${end.y} Z`
}

type WheelProps = {
  /** The pocket the ball is heading for, or null while the wheel sits empty. */
  pocket: number | null
  spinning: boolean
}

/**
 * A casino wheel rather than a fairground one: the face turns at a slow,
 * constant crawl and is never stopped, while the ball is thrown the other way
 * along an entry tangent, runs the outer groove under a constant deceleration
 * and falls into the pockets as it comes down to the wheel's own speed. Once
 * the spin is over the ball simply rides round in its pocket.
 *
 * Both are driven straight from the DOM inside one animation frame loop, so
 * the browser never has to re-render React for a frame of motion.
 */
export default function Wheel({ pocket, spinning }: WheelProps) {
  const face = useRef<SVGGElement>(null)
  const ball = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const faceNode = face.current
    if (faceNode === null) return

    // A landed spin is picked up as though it had been thrown long enough ago
    // for the ball to have dropped, so a refresh — or the hand-over from
    // spinning to the summary — leaves it sitting in its pocket rather than
    // throwing it in all over again.
    const started = performance.now() - (spinning ? 0 : LANDING_MS)
    // Deriving the starting angle from the clock keeps the face turning from
    // wherever it had got to instead of snapping back to the top.
    const from = wheelAngle(started)

    let frame = 0
    const draw = (now: number) => {
      const elapsed = now - started
      faceNode.style.transform = `rotate(${wheelAngle(elapsed, from)}deg)`

      const ballNode = ball.current
      if (ballNode !== null && pocket !== null) {
        const { x, y } = ballAt(elapsed, pocket, from)
        ballNode.setAttribute('cx', String(x))
        ballNode.setAttribute('cy', String(y))
      }

      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [pocket, spinning])

  return (
    <div className="roulette-wheel">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="roulette-wheel-svg" role="img" aria-label="Roulette wheel">
        <circle cx={CENTRE} cy={CENTRE} r={BOWL_RADIUS} className="wheel-bowl" />
        <circle cx={CENTRE} cy={CENTRE} r={TRACK_RADIUS} className="wheel-track" />

        <g className="wheel-face" ref={face}>
          {WHEEL.map((number, index) => (
            <path key={number} d={wedge(index)} className={`wheel-pocket colour-${colourOf(number)}`} />
          ))}
          {WHEEL.map((number, index) => {
            const { x, y } = polar(NUMBER_RADIUS, index * POCKET_STEP)
            return (
              <text
                key={number}
                x={x}
                y={y}
                className="wheel-number"
                transform={`rotate(${index * POCKET_STEP} ${x} ${y})`}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {number}
              </text>
            )
          })}
          <circle cx={CENTRE} cy={CENTRE} r={HUB_RADIUS} className="wheel-hub" />
        </g>

        {pocket !== null && <circle ref={ball} r={BALL_RADIUS} cx={CENTRE} cy={CENTRE} className="wheel-ball" />}
      </svg>

      <div className="roulette-wheel-result">
        {spinning || pocket === null ? (
          <span className="hint">Spinning…</span>
        ) : (
          <span className={`roulette-result colour-${colourOf(pocket)}`}>{pocket}</span>
        )}
      </div>
    </div>
  )
}
