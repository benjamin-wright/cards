import { describe, expect, it } from 'vitest'
import { HIDE_ANGLE, REVEAL_ANGLE, nextTilt } from './orientation'

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
