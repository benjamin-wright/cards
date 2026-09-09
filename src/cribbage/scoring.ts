import type { Card } from '../cards'
import { rankOrder } from '../cards'

export type ScoreDetail = {
  kind: 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs'
  points: number
  description: string
}

export type HandScoreResult = {
  totalPoints: number
  details: ScoreDetail[]
}

export type PeggingScoreResult = {
  points: number
  reasons: string[]
}

export function cardValue(card: Card): number {
  if (card.rank === 'A') return 1
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10
  return parseInt(card.rank, 10)
}

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (items.length < size) return []
  const [first, ...rest] = items
  const withFirst = combinations(rest, size - 1).map(comb => [first, ...comb])
  const withoutFirst = combinations(rest, size)
  return [...withFirst, ...withoutFirst]
}

function isRunOfLength(cards: Card[]): boolean {
  if (cards.length < 3) return false
  const ranks = cards.map(c => rankOrder(c.rank)).sort((a, b) => a - b)
  const uniqueRanks = new Set(ranks)
  if (uniqueRanks.size !== cards.length) return false
  return ranks[ranks.length - 1] - ranks[0] === cards.length - 1
}

export function scoreHand(handCards: Card[], starter: Card, isCrib: boolean): HandScoreResult {
  const allCards = [...handCards, starter]
  const details: ScoreDetail[] = []
  let totalPoints = 0

  // 1. Fifteens
  let fifteenCount = 0
  for (let size = 2; size <= 5; size += 1) {
    for (const comb of combinations(allCards, size)) {
      const sum = comb.reduce((acc, card) => acc + cardValue(card), 0)
      if (sum === 15) {
        fifteenCount += 1
      }
    }
  }
  if (fifteenCount > 0) {
    const pts = fifteenCount * 2
    totalPoints += pts
    details.push({
      kind: 'fifteen',
      points: pts,
      description: `${fifteenCount} fifteen${fifteenCount > 1 ? 's' : ''} (${pts} pts)`,
    })
  }

  // 2. Pairs
  let pairCount = 0
  for (const comb of combinations(allCards, 2)) {
    if (comb[0].rank === comb[1].rank) {
      pairCount += 1
    }
  }
  if (pairCount > 0) {
    const pts = pairCount * 2
    totalPoints += pts
    let desc = `${pairCount} pair${pairCount > 1 ? 's' : ''} (${pts} pts)`
    if (pairCount === 3) desc = `3 of a kind (${pts} pts)`
    if (pairCount === 6) desc = `4 of a kind (${pts} pts)`
    details.push({
      kind: 'pair',
      points: pts,
      description: desc,
    })
  }

  // 3. Runs
  for (let len = 5; len >= 3; len -= 1) {
    const validRuns = combinations(allCards, len).filter(isRunOfLength)
    if (validRuns.length > 0) {
      const pts = validRuns.length * len
      totalPoints += pts
      details.push({
        kind: 'run',
        points: pts,
        description: `${validRuns.length} run${validRuns.length > 1 ? 's' : ''} of ${len} (${pts} pts)`,
      })
      break
    }
  }

  // 4. Flush
  if (isCrib) {
    const firstSuit = allCards[0].suit
    if (allCards.every(c => c.suit === firstSuit)) {
      totalPoints += 5
      details.push({
        kind: 'flush',
        points: 5,
        description: '5-card crib flush (5 pts)',
      })
    }
  } else if (handCards.length === 4) {
    const handSuit = handCards[0].suit
    if (handCards.every(c => c.suit === handSuit)) {
      const starterMatches = starter.suit === handSuit
      const pts = starterMatches ? 5 : 4
      totalPoints += pts
      details.push({
        kind: 'flush',
        points: pts,
        description: `${pts}-card flush (${pts} pts)`,
      })
    }
  }

  // 5. His Nobs
  const hasNobs = handCards.some(c => c.rank === 'J' && c.suit === starter.suit)
  if (hasNobs) {
    totalPoints += 1
    details.push({
      kind: 'nobs',
      points: 1,
      description: 'His Nobs (1 pt)',
    })
  }

  return { totalPoints, details }
}

export function scorePegging(playSequence: Card[], newCount: number): PeggingScoreResult {
  const reasons: string[] = []
  let points = 0
  const n = playSequence.length

  if (n === 0) {
    return { points: 0, reasons: [] }
  }

  // 15
  if (newCount === 15) {
    points += 2
    reasons.push('15 for 2')
  }

  // 31
  if (newCount === 31) {
    points += 2
    reasons.push('31 for 2')
  }

  // Pairs / 3 of a kind / 4 of a kind
  const latestRank = playSequence[n - 1].rank
  let matchCount = 1
  for (let i = n - 2; i >= 0; i -= 1) {
    if (playSequence[i].rank === latestRank) {
      matchCount += 1
    } else {
      break
    }
  }

  if (matchCount === 4) {
    points += 12
    reasons.push('Four of a kind for 12')
  } else if (matchCount === 3) {
    points += 6
    reasons.push('Three of a kind for 6')
  } else if (matchCount === 2) {
    points += 2
    reasons.push('Pair for 2')
  }

  // Runs
  for (let k = n; k >= 3; k -= 1) {
    const sub = playSequence.slice(n - k)
    if (isRunOfLength(sub)) {
      points += k
      reasons.push(`Run of ${k} for ${k}`)
      break
    }
  }

  return { points, reasons }
}

export function scoreHeels(starter: Card): number {
  return starter.rank === 'J' ? 2 : 0
}
