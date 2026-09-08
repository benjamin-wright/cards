import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearState, readState, writeState } from './storage'

function fakeStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: fakeStorage() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage', () => {
  it('round-trips a value', () => {
    writeState('demo', { cash: 100 })
    expect(readState('demo')).toEqual({ cash: 100 })
  })

  it('returns undefined for missing values', () => {
    expect(readState('missing')).toBeUndefined()
  })

  it('returns undefined for corrupt values', () => {
    window.localStorage.setItem('cards.demo', '{ not json')
    expect(readState('demo')).toBeUndefined()
  })

  it('clears a value', () => {
    writeState('demo', 1)
    clearState('demo')
    expect(readState('demo')).toBeUndefined()
  })

  it('survives storage being unavailable', () => {
    vi.stubGlobal('window', undefined)
    expect(() => writeState('demo', 1)).not.toThrow()
    expect(() => clearState('demo')).not.toThrow()
    expect(readState('demo')).toBeUndefined()
  })
})
