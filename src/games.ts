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
    description: 'Match suit or rank to go out first — eights skip, twos pile up, jacks change suit.',
    minPlayers: 2,
    maxPlayers: 2,
    rank: '8',
    suit: 'clubs',
    available: true,
  },
  {
    id: 'hearts',
    name: 'Hearts',
    description: 'Avoid the hearts and the queen of spades, or shoot the moon.',
    minPlayers: 4,
    maxPlayers: 4,
    rank: 'J',
    suit: 'clubs',
    available: false,
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
