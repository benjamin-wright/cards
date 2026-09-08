import { describe, expect, it } from 'vitest'
import { STARTING_CASH, createPlayer, displayName, isPlayerList, resetCash } from './players'

describe('createPlayer', () => {
  it('starts with the standard pile and a unique id', () => {
    const [a, b] = [createPlayer(0), createPlayer(1)]
    expect(a.cash).toBe(STARTING_CASH)
    expect(a.id).not.toBe(b.id)
  })
})

describe('displayName', () => {
  it('falls back to a numbered name', () => {
    expect(displayName({ id: 'a', name: '  ', cash: 0 }, 2)).toBe('Player 3')
    expect(displayName({ id: 'a', name: 'Ada', cash: 0 }, 2)).toBe('Ada')
  })
})

describe('resetCash', () => {
  it('puts everyone back to the starting pile', () => {
    const players = [
      { id: 'a', name: 'Ada', cash: 3 },
      { id: 'b', name: 'Bob', cash: 250 },
    ]
    expect(resetCash(players)).toEqual([
      { id: 'a', name: 'Ada', cash: STARTING_CASH },
      { id: 'b', name: 'Bob', cash: STARTING_CASH },
    ])
    expect(players[0].cash).toBe(3)
  })
})

describe('isPlayerList', () => {
  const players = [
    { id: 'a', name: 'Ada', cash: 100 },
    { id: 'b', name: 'Bob', cash: 100 },
  ]

  it('accepts a valid list', () => {
    expect(isPlayerList(players)).toBe(true)
  })

  it('rejects malformed or wrongly sized lists', () => {
    expect(isPlayerList(undefined)).toBe(false)
    expect(isPlayerList([])).toBe(false)
    expect(isPlayerList([players[0]])).toBe(false)
    expect(isPlayerList([...players, ...players, players[0]])).toBe(false)
    expect(isPlayerList([players[0], { id: 'b', name: 'Bob' }])).toBe(false)
    expect(isPlayerList([players[0], { id: 'b', name: 'Bob', cash: 'lots' }])).toBe(false)
  })
})
