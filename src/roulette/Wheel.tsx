import { useEffect, useRef } from 'react'
import { POCKETS, WHEEL, colourOf, pocketAngle } from './wheel'

/** How long the wheel takes to come to rest. */
export const SPIN_MS = 4500

const SIZE = 200
const CENTRE = SIZE / 2
const RIM = CENTRE - 4
const HUB = CENTRE * 0.42
const STEP = 360 / POCKETS
/** Full turns before the wheel settles, so the result isn't given away early. */
const TURNS = 6

function point(radius: number, degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180
  return [CENTRE + radius * Math.cos(radians), CENTRE + radius * Math.sin(radians)]
}

function wedge(index: number): string {
  const [x1, y1] = point(RIM, index * STEP - STEP / 2)
  const [x2, y2] = point(RIM, index * STEP + STEP / 2)
  return `M ${CENTRE} ${CENTRE} L ${x1} ${y1} A ${RIM} ${RIM} 0 0 1 ${x2} ${y2} Z`
}

type WheelProps = {
  /** The pocket to settle on, or null while the wheel sits still. */
  pocket: number | null
  spinning: boolean
}

/**
 * The wheel is drawn once with zero at the top, then turned so the winning
 * pocket comes to rest under the marker. Rotating clockwise by
 * `360 * turns - pocketAngle` lands the pocket at twelve o'clock however many
 * whole turns it takes on the way.
 */
export default function Wheel({ pocket, spinning }: WheelProps) {
  const face = useRef<SVGGElement>(null)

  // The turning wheel is driven straight from the DOM rather than through
  // React state, so the browser animates the transform without a re-render
  // for every frame.
  useEffect(() => {
    const node = face.current
    if (node === null) return

    const settle = (degrees: number) => {
      node.style.transition = 'none'
      node.style.transform = `rotate(${degrees}deg)`
    }

    if (pocket === null) {
      settle(0)
      return
    }

    const resting = TURNS * 360 - pocketAngle(pocket)
    if (!spinning) {
      settle(resting)
      return
    }

    // A frame at the starting angle first, so the browser has something to
    // animate away from when the round is picked up mid-spin after a refresh.
    settle(0)
    const frame = requestAnimationFrame(() => {
      node.style.transition = `transform ${SPIN_MS}ms cubic-bezier(0.16, 0.85, 0.2, 1)`
      node.style.transform = `rotate(${resting}deg)`
    })
    return () => cancelAnimationFrame(frame)
  }, [pocket, spinning])

  return (
    <div className="roulette-wheel">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="roulette-wheel-svg" role="img" aria-label="Roulette wheel">
        <circle cx={CENTRE} cy={CENTRE} r={CENTRE - 1} className="wheel-rim" />
        <g className="wheel-face" ref={face}>
          {WHEEL.map((number, index) => (
            <path key={number} d={wedge(index)} className={`wheel-pocket colour-${colourOf(number)}`} />
          ))}
          {WHEEL.map((number, index) => {
            const [x, y] = point(RIM * 0.8, index * STEP)
            return (
              <text
                key={number}
                x={x}
                y={y}
                className="wheel-number"
                transform={`rotate(${index * STEP} ${x} ${y})`}
                dominantBaseline="middle"
                textAnchor="middle"
              >
                {number}
              </text>
            )
          })}
          <circle cx={CENTRE} cy={CENTRE} r={HUB} className="wheel-hub" />
        </g>
        <path d={`M ${CENTRE - 8} 2 L ${CENTRE + 8} 2 L ${CENTRE} 20 Z`} className="wheel-marker" />
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
