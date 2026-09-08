export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export type Game = {
  id: string
  name: string
  description: string
  players: string
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
    id: 'whist',
    name: 'Whist',
    description: 'Classic trick taking for four players in two partnerships.',
    players: '4 players',
    rank: 'A',
    suit: 'spades',
    available: false,
  },
  {
    id: 'rummy',
    name: 'Rummy',
    description: 'Draw, discard and lay down sets and runs to go out first.',
    players: '2-6 players',
    rank: 'K',
    suit: 'hearts',
    available: false,
  },
  {
    id: 'cribbage',
    name: 'Cribbage',
    description: 'Peg your way to 121 with fifteens, runs and pairs.',
    players: '2-3 players',
    rank: 'Q',
    suit: 'diamonds',
    available: false,
  },
  {
    id: 'hearts',
    name: 'Hearts',
    description: 'Avoid the hearts and the queen of spades, or shoot the moon.',
    players: '4 players',
    rank: 'J',
    suit: 'clubs',
    available: false,
  },
]
