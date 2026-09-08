import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const PREFIX = 'cards.'

export const STORAGE_KEYS = {
  app: 'app',
  blackjack: 'blackjack',
  rummy: 'rummy',
} as const

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Reads a stored value, returning undefined when absent or unreadable. */
export function readState<T>(key: string): T | undefined {
  const store = storage()
  if (store === null) return undefined

  try {
    const raw = store.getItem(PREFIX + key)
    return raw === null ? undefined : (JSON.parse(raw) as T)
  } catch {
    return undefined
  }
}

export function writeState<T>(key: string, value: T): void {
  const store = storage()
  if (store === null) return

  try {
    store.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full — the game still works in memory */
  }
}

export function clearState(key: string): void {
  const store = storage()
  if (store === null) return

  try {
    store.removeItem(PREFIX + key)
  } catch {
    /* nothing to do */
  }
}

/**
 * State that survives a refresh. `create` is only called when there is no
 * usable stored value.
 */
export function usePersistentState<T>(
  key: string,
  create: () => T,
  isValid: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const stored = readState<unknown>(key)
    return isValid(stored) ? stored : create()
  })

  useEffect(() => {
    writeState(key, value)
  }, [key, value])

  return [value, setValue]
}
