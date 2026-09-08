import { RANKS, cardKey, rankOrder, type Card } from '../cards'

export type MeldKind = 'set' | 'run'

export type Meld = {
  kind: MeldKind
  cards: Card[]
}

/** How a hand splits into melds and left-over deadwood. */
export type Layout = {
  melds: Meld[]
  deadwood: Card[]
  deadwoodValue: number
}

export const GIN_BONUS = 25
export const UNDERCUT_BONUS = 25
/** Deadwood a player must be at or below to knock. */
export const KNOCK_LIMIT = 10
export const HAND_SIZE = 10

/** Face cards are worth 10, aces 1, everything else its pip value. */
export function cardValue(card: Card): number {
  if (card.rank === 'A') return 1
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10
  return Number(card.rank)
}

export function handValue(cards: Card[]): number {
  return cards.reduce((total, card) => total + cardValue(card), 0)
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => rankOrder(a.rank) - rankOrder(b.rank) || a.suit.localeCompare(b.suit))
}

/** Every set of three or four cards of the same rank in the hand. */
function setsIn(cards: Card[]): Meld[] {
  const melds: Meld[] = []

  for (const rank of RANKS) {
    const matching = cards.filter(card => card.rank === rank)
    if (matching.length < 3) continue

    if (matching.length === 4) {
      melds.push({ kind: 'set', cards: matching })
      // Any three of the four can also stand alone, which sometimes leaves a
      // more useful card free for a run.
      for (let skip = 0; skip < 4; skip += 1) {
        melds.push({ kind: 'set', cards: matching.filter((_, index) => index !== skip) })
      }
    } else {
      melds.push({ kind: 'set', cards: matching })
    }
  }

  return melds
}

/** Every run of three or more cards in a suit. Aces are low. */
function runsIn(cards: Card[]): Meld[] {
  const melds: Meld[] = []
  const bySuit = new Map<string, Card[]>()

  for (const card of cards) {
    bySuit.set(card.suit, [...(bySuit.get(card.suit) ?? []), card])
  }

  for (const suited of bySuit.values()) {
    const ordered = sortCards(suited)
    for (let start = 0; start < ordered.length; start += 1) {
      const run: Card[] = [ordered[start]]
      for (let next = start + 1; next < ordered.length; next += 1) {
        if (rankOrder(ordered[next].rank) !== rankOrder(run[run.length - 1].rank) + 1) break
        run.push(ordered[next])
        if (run.length >= 3) {
          melds.push({ kind: 'run', cards: [...run] })
        }
      }
    }
  }

  return melds
}

export function possibleMelds(cards: Card[]): Meld[] {
  return [...setsIn(cards), ...runsIn(cards)]
}

function toLayout(melds: Meld[], cards: Card[]): Layout {
  const used = new Set(melds.flatMap(meld => meld.cards).map(cardKey))
  const deadwood = sortCards(cards.filter(card => !used.has(cardKey(card))))
  return { melds, deadwood, deadwoodValue: handValue(deadwood) }
}

/**
 * Picks the meld arrangement that leaves the least deadwood, so players never
 * have to spot their own sets and runs.
 */
export function bestLayout(cards: Card[]): Layout {
  const melds = possibleMelds(cards)

  let best: Meld[] = []
  let bestValue = handValue(cards)

  const search = (index: number, chosen: Meld[], used: Set<string>, remaining: number) => {
    if (remaining < bestValue) {
      best = [...chosen]
      bestValue = remaining
    }
    if (bestValue === 0) return

    for (let next = index; next < melds.length; next += 1) {
      const meld = melds[next]
      if (meld.cards.some(card => used.has(cardKey(card)))) continue

      const taken = new Set(used)
      for (const card of meld.cards) taken.add(cardKey(card))

      chosen.push(meld)
      search(next + 1, chosen, taken, remaining - handValue(meld.cards))
      chosen.pop()
    }
  }

  search(0, [], new Set<string>(), handValue(cards))

  return toLayout(best, cards)
}

export function deadwoodValue(cards: Card[]): number {
  return bestLayout(cards).deadwoodValue
}

export function canKnock(cards: Card[]): boolean {
  return deadwoodValue(cards) <= KNOCK_LIMIT
}

export function isGin(cards: Card[]): boolean {
  return deadwoodValue(cards) === 0
}

/** True when `card` extends the meld, as a fourth of a set or either end of a run. */
export function extendsMeld(meld: Meld, card: Card): boolean {
  if (meld.kind === 'set') {
    return meld.cards.length < 4 && meld.cards[0].rank === card.rank
  }

  if (meld.cards[0].suit !== card.suit) return false
  const low = rankOrder(meld.cards[0].rank)
  const high = rankOrder(meld.cards[meld.cards.length - 1].rank)
  const position = rankOrder(card.rank)
  return position === low - 1 || position === high + 1
}

/**
 * Lays the defender's deadwood off onto the knocker's melds. That is always in
 * the defender's favour, so it is done for them.
 */
export function layOff(deadwood: Card[], melds: Meld[]): { melds: Meld[]; deadwood: Card[] } {
  const grown: Meld[] = melds.map(meld => ({ ...meld, cards: [...meld.cards] }))
  const left: Card[] = []

  // Highest cards first, so the most valuable deadwood is shed when several
  // cards compete for the same meld.
  for (const card of [...deadwood].sort((a, b) => cardValue(b) - cardValue(a))) {
    const target = grown.find(meld => extendsMeld(meld, card))
    if (target === undefined) {
      left.push(card)
      continue
    }

    target.cards = sortCards([...target.cards, card])
  }

  return { melds: grown, deadwood: sortCards(left) }
}
