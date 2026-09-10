export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export type Game = {
  id: string
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  rank: string
  suit: Suit
  available: boolean
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

export const games: Game[] = [
  {
    id: 'blackjack',
    name: 'Blackjack',
    description: 'Twist or stick to get closest to 21 without going bust.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: 'A',
    suit: 'spades',
    available: true,
  },
  {
    id: 'rummy',
    name: 'Rummy',
    description: 'Draw, discard and lay down sets and runs to go out first.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: 'K',
    suit: 'hearts',
    available: true,
  },
  {
    id: 'cribbage',
    name: 'Cribbage',
    description: 'Peg your way to 121 with fifteens, runs and pairs.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: 'Q',
    suit: 'diamonds',
    available: true,
  },
  {
    id: 'crazy-eights',
    name: 'Crazy Eights',
    description: 'Match suit or rank to go out first — eights change suit, tens are see-through, jacks skip, twos pile up.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: '8',
    suit: 'clubs',
    available: true,
  },
  {
    id: 'roulette',
    name: 'Roulette',
    description: 'Back your numbers with £1, £5 and £10 chips, then spin the wheel.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: 'J',
    suit: 'hearts',
    available: true,
  },
]

export function playerCountLabel(game: Game): string {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} players`
    : `${game.minPlayers}-${game.maxPlayers} players`
}

export function supportsPlayerCount(game: Game, playerCount: number): boolean {
  return playerCount >= game.minPlayers && playerCount <= game.maxPlayers
}

export function isPlayable(game: Game, playerCount: number): boolean {
  return game.available && supportsPlayerCount(game, playerCount)
}
