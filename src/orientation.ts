import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Which way the device is tipped. `flat` means it's lying on the table (or
 * being held level) and belongs to nobody; `left` and `right` mean it's been
 * angled towards the player sitting on that side.
 */
export type Tilt = 'flat' | 'left' | 'right'

/**
 * Tilt sensors need explicit permission on some platforms. Without them the
 * app can't tell who's holding the device, so it falls back to manual
 * show/hide toggles.
 */
export type TiltAccess = 'unavailable' | 'prompt' | 'granted'

export type DeviceView = {
  tilt: Tilt
  tiltAccess: TiltAccess
  /** False while the browser has turned the page sideways. */
  portrait: boolean
  /** True once the page is pinned to portrait, so tilting can't rotate it. */
  locked: boolean
  /** Whether this browser can pin the page to portrait at all. */
  canLock: boolean
  /** Asks for tilt access and pins the page to portrait, in one gesture. */
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
  return typeof api.requestPermission === 'function' ? 'prompt' : 'granted'
}

function screenOrientation(): ScreenOrientation | null {
  if (typeof window === 'undefined') return null
  return window.screen?.orientation ?? null
}

function lockSupported(): boolean {
  return typeof screenOrientation()?.lock === 'function'
}

function isPortrait(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(PORTRAIT).matches
}

/** Most browsers only allow an orientation lock while in fullscreen. */
async function lockPortrait(): Promise<boolean> {
  const orientation = screenOrientation()
  if (orientation === null || typeof orientation.lock !== 'function') return false

  try {
    if (document.fullscreenElement === null && typeof document.documentElement.requestFullscreen === 'function') {
      await document.documentElement.requestFullscreen()
    }
    await orientation.lock('portrait')
    return true
  } catch {
    return false
  }
}

/**
 * Reads how the device is being held without letting the browser's own
 * rotation get involved. The page is pinned to portrait, so turning the device
 * towards one player tips the tilt reading rather than spinning the layout.
 */
export function useDeviceView(): DeviceView {
  const [tilt, setTilt] = useState<Tilt>('flat')
  const [tiltAccess, setTiltAccess] = useState<TiltAccess>(initialAccess)
  const [portrait, setPortrait] = useState<boolean>(isPortrait)
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const query = window.matchMedia(PORTRAIT)
    const update = () => setPortrait(query.matches)

    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (tiltAccess !== 'granted' || typeof window === 'undefined') return

    const update = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return
      const { gamma } = event
      setTilt(current => nextTilt(current, gamma))
    }

    window.addEventListener('deviceorientation', update)
    return () => window.removeEventListener('deviceorientation', update)
  }, [tiltAccess])

  // The lock belongs to the screen that asked for it, so it's released again
  // on the way out rather than left on for the rest of the app.
  useEffect(
    () => () => {
      if (lockedRef.current) {
        screenOrientation()?.unlock()
      }
    },
    [],
  )

  const enable = useCallback(() => {
    const api = permissionApi()

    // A refused prompt or an unsupported lock just leaves the manual toggles
    // in place, which still works.
    if (api !== null && typeof api.requestPermission === 'function') {
      api
        .requestPermission()
        .then(state => setTiltAccess(state === 'granted' ? 'granted' : 'unavailable'))
        .catch(() => setTiltAccess('unavailable'))
    }

    void lockPortrait().then(success => {
      lockedRef.current = success
      setLocked(success)
    })
  }, [])

  return { tilt, tiltAccess, portrait, locked, canLock: lockSupported(), enable }
}
