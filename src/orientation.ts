import { useCallback, useEffect, useState } from 'react'

export type Orientation = 'portrait' | 'landscape'

/** Whether the device is lying flat on the table or being held up by a player. */
export type Posture = 'flat' | 'upright'

/**
 * Tilt sensors need explicit permission on some platforms. Without them the
 * app can't tell flat from held, so it falls back to manual show/hide toggles.
 */
export type TiltAccess = 'unavailable' | 'prompt' | 'granted'

export type DeviceView = {
  orientation: Orientation
  posture: Posture
  /** Screen rotation in degrees: 0, 90, 180 or 270. */
  angle: number
  tiltAccess: TiltAccess
  requestTilt: () => void
}

/** Degrees from horizontal at or below which the device counts as lying flat. */
export const FLAT_LIMIT = 30
/** Degrees from horizontal at or above which the device counts as held up. */
export const UPRIGHT_LIMIT = 45

const LANDSCAPE = '(orientation: landscape)'

/** How far the screen is tipped away from horizontal, in degrees. */
export function screenTilt(beta: number, gamma: number): number {
  const b = (beta * Math.PI) / 180
  const g = (gamma * Math.PI) / 180
  const level = Math.min(1, Math.abs(Math.cos(b) * Math.cos(g)))
  return (Math.acos(level) * 180) / Math.PI
}

/**
 * The two limits leave a dead band between them, so a wobbling hand near the
 * threshold doesn't flap the hands open and shut.
 */
export function nextPosture(current: Posture, beta: number, gamma: number): Posture {
  const tilt = screenTilt(beta, gamma)
  if (tilt >= UPRIGHT_LIMIT) return 'upright'
  if (tilt <= FLAT_LIMIT) return 'flat'
  return current
}

/**
 * Which of the two seats the bottom of the screen faces. The browser rotates
 * the page as the device is turned, so the seat nearest the holder flips when
 * the device is turned upside down.
 */
export function nearSeat(angle: number): 0 | 1 {
  return angle === 180 || angle === 270 ? 1 : 0
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
  return typeof api.requestPermission === 'function' ? 'prompt' : 'granted'
}

function currentOrientation(): Orientation {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'portrait'
  return window.matchMedia(LANDSCAPE).matches ? 'landscape' : 'portrait'
}

function currentAngle(): number {
  if (typeof window === 'undefined') return 0
  return window.screen?.orientation?.angle ?? 0
}

/**
 * How the device is being held: flat on the table between both players, or
 * tilted up towards one of them. Combined with the screen rotation this tells
 * the two players apart, since the browser turns the page around when the
 * device is held upside down.
 */
export function useDeviceView(): DeviceView {
  const [orientation, setOrientation] = useState<Orientation>(currentOrientation)
  const [angle, setAngle] = useState<number>(currentAngle)
  const [posture, setPosture] = useState<Posture>('flat')
  const [tiltAccess, setTiltAccess] = useState<TiltAccess>(initialAccess)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia(LANDSCAPE)
    const update = () => {
      setOrientation(query.matches ? 'landscape' : 'portrait')
      setAngle(currentAngle())
    }

    update()
    query.addEventListener('change', update)
    window.addEventListener('orientationchange', update)
    window.screen?.orientation?.addEventListener('change', update)

    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('orientationchange', update)
      window.screen?.orientation?.removeEventListener('change', update)
    }
  }, [])

  useEffect(() => {
    if (tiltAccess !== 'granted' || typeof window === 'undefined') return

    const update = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      const { beta, gamma } = event
      setPosture(current => nextPosture(current, beta, gamma))
    }

    window.addEventListener('deviceorientation', update)
    return () => window.removeEventListener('deviceorientation', update)
  }, [tiltAccess])

  const requestTilt = useCallback(() => {
    const api = permissionApi()
    if (api === null || typeof api.requestPermission !== 'function') return

    // A rejected prompt leaves the manual toggles in place, which still works.
    api
      .requestPermission()
      .then(state => setTiltAccess(state === 'granted' ? 'granted' : 'unavailable'))
      .catch(() => setTiltAccess('unavailable'))
  }, [])

  return { orientation, posture, angle, tiltAccess, requestTilt }
}
