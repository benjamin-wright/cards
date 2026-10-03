import { describe, expect, it } from 'vitest'
import { compareHands, handScore, isBust } from './engine'
import type { Card } from '../cards'

const card = (rank: Card['rank'], suit: Card['suit'] = 'spades'): Card => ({ rank, suit })

describe('blackjack scoring', () => {
  it('scores picture cards and promotes an ace when it fits', () => {
    expect(handScore([card('7'), card('9')])).toBe(16)
    expect(handScore([card('A'), card('K')])).toBe(21)
    expect(handScore([card('A'), card('A', 'hearts'), card('9')])).toBe(21)
    expect(handScore([card('A'), card('K'), card('9')])).toBe(20)
    expect(isBust([card('K'), card('Q'), card('5')])).toBe(true)
  })

  it('awards the higher non-bust hand the win', () => {
    expect(compareHands([card('K'), card('9')], [card('10'), card('8')])).toBe(1)
    expect(compareHands([card('10'), card('8')], [card('K'), card('9')])).toBe(-1)
  })

  it('draws equal scores and two bust hands', () => {
    expect(compareHands([card('10'), card('8')], [card('K'), card('8', 'hearts')])).toBe(0)
    expect(compareHands([card('K'), card('Q'), card('5')], [card('K'), card('Q'), card('7')])).toBe(0)
    expect(compareHands([card('K'), card('Q'), card('5')], [card('2'), card('3')])).toBe(-1)
  })
})
