import { useCallback, useEffect, useState } from 'react'

/**
 * Which way the device is tipped. `flat` means it's lying on the table (or
 * being held level) and belongs to nobody; `left` and `right` mean it's been
 * angled towards the player sitting on that side.
 */
export type Tilt = 'flat' | 'left' | 'right'

export type TiltAccess = 'unavailable' | 'prompt' | 'checking' | 'granted'

export function deviceGate(portrait: boolean, access: TiltAccess): 'orientation' | 'tilt' | null {
  if (!portrait) return 'orientation'
  return access === 'granted' ? null : 'tilt'
}

export type DeviceView = {
  tilt: Tilt
  tiltAccess: TiltAccess
  /** False while the browser has turned the page sideways. */
  portrait: boolean
  /** Requests tilt access in response to a user gesture. */
  enable: () => void
}

/** Degrees the device must be angled towards a player to show their hand. */
export const REVEAL_ANGLE = 35
/** Degrees it must fall back to before the hand is hidden again. */
export const HIDE_ANGLE = 20

const PORTRAIT = '(orientation: portrait)'

/**
 * Which player the screen is angled towards. `gamma` is the roll about the
 * long axis of the device: tipping the right edge down turns the screen to
 * face right, which is a positive angle.
 *
 * The two thresholds leave a dead band between them, so a wobbling hand near
 * the limit doesn't flap the cards open and shut.
 */
export function nextTilt(current: Tilt, gamma: number): Tilt {
  if (gamma <= -REVEAL_ANGLE) return 'left'
  if (gamma >= REVEAL_ANGLE) return 'right'
  if (Math.abs(gamma) <= HIDE_ANGLE) return 'flat'
  return current
}

type PermissionApi = { requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'> }

function permissionApi(): PermissionApi | null {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
    return null
  }
  return window.DeviceOrientationEvent as unknown as PermissionApi
}

function initialAccess(): TiltAccess {
  const api = permissionApi()
  if (api === null) return 'unavailable'
  return typeof api.requestPermission === 'function' ? 'prompt' : 'checking'
}

function isPortrait(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(PORTRAIT).matches
}

/**
 * Reads device tilt while the page remains in portrait. If rotation is not
 * locked by the user, the table is covered until portrait is restored.
 */
export function useDeviceView(): DeviceView {
  const [tilt, setTilt] = useState<Tilt>('flat')
  const [tiltAccess, setTiltAccess] = useState<TiltAccess>(initialAccess)
  const [portrait, setPortrait] = useState<boolean>(isPortrait)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia(PORTRAIT)
    const update = () => {
      setPortrait(query.matches)
      if (!query.matches) setTilt('flat')
    }

    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if ((tiltAccess !== 'checking' && tiltAccess !== 'granted') || typeof window === 'undefined') return

    const update = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || !Number.isFinite(event.gamma)) return
      const { gamma } = event
      setTiltAccess('granted')
      setTilt(current => isPortrait() ? nextTilt(current, gamma) : 'flat')
    }

    window.addEventListener('deviceorientation', update)
    const timer = tiltAccess === 'checking' ? window.setTimeout(() => setTiltAccess('unavailable'), 5000) : null
    return () => {
      window.removeEventListener('deviceorientation', update)
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [tiltAccess])

  const enable = useCallback(() => {
    const api = permissionApi()
    if (api === null) {
      setTiltAccess('unavailable')
      return
    }
    if (api !== null && typeof api.requestPermission === 'function') {
      api
        .requestPermission()
        .then(state => setTiltAccess(state === 'granted' ? 'checking' : 'unavailable'))
        .catch(() => setTiltAccess('unavailable'))
    } else {
      setTiltAccess('checking')
    }
  }, [])

  return { tilt, tiltAccess, portrait, enable }
}
