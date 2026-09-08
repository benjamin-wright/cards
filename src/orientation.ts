import { useEffect, useState } from 'react'

export type Orientation = 'portrait' | 'landscape'

const LANDSCAPE = '(orientation: landscape)'

function currentOrientation(): Orientation {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'portrait'
  }
  return window.matchMedia(LANDSCAPE).matches ? 'landscape' : 'portrait'
}

/**
 * Which way up the device is being held. Landscape means it's lying between
 * the two players with both sides of the table on screen; portrait means it's
 * being held and passed from player to player.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(currentOrientation)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia(LANDSCAPE)
    const update = () => setOrientation(query.matches ? 'landscape' : 'portrait')

    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return orientation
}
