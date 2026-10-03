import { describe, expect, it } from 'vitest'
import { HIDE_ANGLE, REVEAL_ANGLE, deviceGate, nextTilt } from './orientation'

describe('deviceGate', () => {
  it('covers the game when the page rotates, even before permission is granted', () => {
    expect(deviceGate(false, 'prompt')).toBe('orientation')
    expect(deviceGate(false, 'granted')).toBe('orientation')
  })

  it('keeps the game covered until a tilt reading is available', () => {
    expect(deviceGate(true, 'prompt')).toBe('tilt')
    expect(deviceGate(true, 'checking')).toBe('tilt')
    expect(deviceGate(true, 'unavailable')).toBe('tilt')
    expect(deviceGate(true, 'granted')).toBeNull()
  })
})

describe('nextTilt', () => {
  it('reads a level device as belonging to nobody', () => {
    expect(nextTilt('left', 0)).toBe('flat')
    expect(nextTilt('right', -HIDE_ANGLE)).toBe('flat')
  })

  it('faces the player on the left when the screen is turned that way', () => {
    expect(nextTilt('flat', -REVEAL_ANGLE)).toBe('left')
    expect(nextTilt('flat', -80)).toBe('left')
  })

  it('faces the player on the right when the screen is turned that way', () => {
    expect(nextTilt('flat', REVEAL_ANGLE)).toBe('right')
    expect(nextTilt('flat', 80)).toBe('right')
  })

  it('holds the last reading in the dead band between the two limits', () => {
    const between = (HIDE_ANGLE + REVEAL_ANGLE) / 2

    expect(nextTilt('flat', between)).toBe('flat')
    expect(nextTilt('right', between)).toBe('right')
    expect(nextTilt('left', -between)).toBe('left')
  })

  it('swaps straight over when the device is turned the other way', () => {
    expect(nextTilt('left', REVEAL_ANGLE)).toBe('right')
    expect(nextTilt('right', -REVEAL_ANGLE)).toBe('left')
  })
})
