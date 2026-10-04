import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Player } from '../players'
import Rummy from '../rummy/Rummy'
import { createRound as createRummyRound } from '../rummy/round'
import CrazyEights from '../crazyeights/CrazyEights'
import { createRound as createEightsRound } from '../crazyeights/round'
import Cribbage from '../cribbage/Cribbage'
import { createRound as createCribbageRound } from '../cribbage/round'
import Roulette from '../roulette/Roulette'
import { createRound as createRouletteRound, placeChip } from '../roulette/round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 100 },
  { id: 'b', name: 'Bob', cash: 100 },
]
const noop = () => {}

function restore(key: string, value: unknown) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (item: string) => item === `cards.${key}` ? JSON.stringify(value) : null,
    },
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('shared table outcomes', () => {
  it('keeps a completed rummy hand private until its flat reveal', () => {
    const round = createRummyRound(players)
    const result = {
      kind: 'draw' as const, winnerId: null, knockerId: null, points: 0,
      hands: round.hands.map(hand => ({ playerId: hand.playerId, name: hand.name, melds: [], deadwood: hand.cards, deadwoodValue: 10 })),
    }
    restore('rummy', { round: { ...round, phase: 'summary', result }, scores: { a: 0, b: 0 }, lastStarterId: 'a', revealed: false })
    const tilted = renderToStaticMarkup(<Rummy players={players} tilt="left" onExit={noop} />)
    const flat = renderToStaticMarkup(<Rummy players={players} tilt="flat" onExit={noop} />)
    expect(tilted).not.toContain('table-reveal-hand')
    expect(flat).toContain('Show hands')
    expect(flat).not.toContain('table-reveal-hand')

    restore('rummy', { round: { ...round, phase: 'summary', result }, scores: { a: 0, b: 0 }, lastStarterId: 'a', revealed: true })
    expect(renderToStaticMarkup(<Rummy players={players} tilt="flat" onExit={noop} />)).toContain('table-reveal-hand')
    expect(renderToStaticMarkup(<Rummy players={players} tilt="left" onExit={noop} />)).not.toContain('table-reveal-hand')
  })

  it('only presents Crazy Eights results on the flat shared table', () => {
    const round = createEightsRound(players)
    const result = { winnerId: 'a', points: 10, hands: round.hands }
    restore('crazyEights', { round: { ...round, result }, scores: { a: 10, b: 0 }, lastStarterId: 'a', revealed: true })
    expect(renderToStaticMarkup(<CrazyEights players={players} tilt="flat" onExit={noop} />)).toContain('table-reveal-hand')
    expect(renderToStaticMarkup(<CrazyEights players={players} tilt="right" onExit={noop} />)).not.toContain('table-reveal-hand')
  })

  it('offers a wheel-centered spin only when flat with a stake and no turn controls', () => {
    const round = createRouletteRound(players)
    restore('roulette', { round })
    const empty = renderToStaticMarkup(<Roulette players={players} tilt="flat" onExit={noop} onSettle={noop} />)
    expect(empty).toMatch(/roulette-wheel-spin" disabled=""[^>]*>SPIN<\/button>/)

    restore('roulette', { round: placeChip(round, 'b', 'red', 5) })
    const flat = renderToStaticMarkup(<Roulette players={players} tilt="flat" onExit={noop} onSettle={noop} />)
    const left = renderToStaticMarkup(<Roulette players={players} tilt="left" onExit={noop} onSettle={noop} />)
    const right = renderToStaticMarkup(<Roulette players={players} tilt="right" onExit={noop} onSettle={noop} />)
    expect(flat).toMatch(/roulette-wheel-spin"[^>]*>SPIN<\/button>/)
    expect(flat).not.toContain('roulette-bet-summary-seat')
    expect(flat).not.toContain('bet-chip--seat-2')
    expect(left).not.toContain('roulette-wheel-spin')
    expect(left).not.toContain('bet-chip--seat-2')
    expect(right).toContain('bet-chip--seat-2')
    expect(left).not.toContain('>Done</button>')
    expect(right).not.toContain('>Done</button>')
  })

  it('requires a flat device and explicit reveal for cribbage scoring', () => {
    const round = createCribbageRound(players)
    const showing = { ...round, phase: 'show', starter: round.deck[0] }
    restore('cribbage', { round: showing, lastStarterId: 'a', showVisible: false })
    const flat = renderToStaticMarkup(<Cribbage players={players} tilt="flat" onExit={noop} />)
    expect(flat).toContain('Show hands')
    expect(flat).not.toContain('score-popup-backdrop')

    restore('cribbage', { round: showing, lastStarterId: 'a', showVisible: true })
    expect(renderToStaticMarkup(<Cribbage players={players} tilt="flat" onExit={noop} />)).toContain('score-popup-backdrop')
    expect(renderToStaticMarkup(<Cribbage players={players} tilt="left" onExit={noop} />)).not.toContain('score-popup-backdrop')
  })
})
