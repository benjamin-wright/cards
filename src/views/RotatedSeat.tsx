import { useEffect, useRef, useState, type ReactNode } from 'react'

type RotatedSeatProps = {
  /** Quarter turn to apply: 90 faces the player on the left, -90 the right. */
  degrees: 90 | -90
  children: ReactNode
}

/**
 * Turns a seat's panel a quarter turn so it reads the right way up for the
 * player sitting on that side of the device. The page itself stays in
 * portrait, so tipping the device towards a player never spins the layout.
 *
 * A rotated element keeps its original box, so the panel is measured and given
 * the slot's dimensions swapped over before being turned.
 */
export default function RotatedSeat({ degrees, children }: RotatedSeatProps) {
  const slot = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const node = slot.current
    if (node === null || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect !== undefined) {
        setBox({ width: rect.width, height: rect.height })
      }
    })

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="seat-slot" ref={slot}>
      <div
        className="seat-rotor"
        style={{
          width: box.height,
          height: box.width,
          transform: `translate(-50%, -50%) rotate(${degrees}deg)`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
