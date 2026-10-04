import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Player } from '../players'
import Blackjack from './Blackjack'
import { createRound, stick } from './round'

const players: Player[] = [
  { id: 'a', name: 'Ada', cash: 0 },
  { id: 'b', name: 'Bob', cash: 0 },
]

function render(round: ReturnType<typeof createRound>, tilt: 'left' | 'right' | 'flat') {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => key === 'cards.blackjack'
        ? JSON.stringify({ round, scores: { a: 0, b: 0 } }) : null,
    },
  })
  return renderToStaticMarkup(<Blackjack players={players} tilt={tilt} onExit={() => {}} />)
}

afterEach(() => vi.unstubAllGlobals())

describe('blackjack private hands', () => {
  it('offers both players controls independently and blocks an early reveal', () => {
    const round = createRound(players)
    expect(render(round, 'left')).toContain('>Twist</button>')
    expect(render(round, 'right')).toContain('>Stick</button>')
    expect(render(round, 'flat')).toMatch(/disabled=""[^>]*>Show hands<\/button>/)
    expect(render(stick(round, 'b'), 'flat')).toMatch(/disabled=""[^>]*>Show hands<\/button>/)
    expect(render(stick(round, 'b'), 'left')).toContain('>Twist</button>')
  })

  it('allows the shared reveal only on a flat device once both finish', () => {
    const ready = stick(stick(createRound(players), 'b'), 'a')
    expect(render(ready, 'left')).toMatch(/disabled=""[^>]*>Show hands<\/button>/)
    expect(render(ready, 'flat')).toMatch(/class="btn-primary"[^>]*>Show hands<\/button>/)
    expect(render(ready, 'flat')).not.toContain('blackjack-showdown-hand')
  })
})
