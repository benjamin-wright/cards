import { useCallback } from 'react'
import GameSelect from './views/GameSelect'
import PlayerSetup from './views/PlayerSetup'
import Blackjack from './blackjack/Blackjack'
import Rummy from './rummy/Rummy'
import Cribbage from './cribbage/Cribbage'
import CrazyEights from './crazyeights/CrazyEights'
import Roulette from './roulette/Roulette'
import { games } from './games'
import { isPlayerList, type Player, type Settlement } from './players'
import { STORAGE_KEYS, clearState, usePersistentState } from './storage'

type AppState = {
  players: Player[]
  editingPlayers: boolean
  gameId: string | null
}

function isAppState(value: unknown): value is AppState {
  const state = value as Partial<AppState>
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof state.editingPlayers === 'boolean' &&
    (state.gameId === null || typeof state.gameId === 'string') &&
    isPlayerList(state.players)
  )
}

function App() {
  const [state, setState] = usePersistentState<AppState>(
    STORAGE_KEYS.app,
    () => ({ players: [], editingPlayers: true, gameId: null }),
    isAppState,
  )

  const { players, editingPlayers, gameId } = state
  const game = games.find(entry => entry.id === gameId) ?? null

  // Games settle from an effect, so the callback is kept stable to avoid
  // re-settling the same results on every render.
  const settle = useCallback(
    (results: Settlement[]) => {
      setState(current => ({
        ...current,
        players: current.players.map(player => {
          const result = results.find(entry => entry.playerId === player.id)
          return result === undefined ? player : { ...player, cash: result.cashAfter }
        }),
      }))
    },
    [setState],
  )

  const clearGames = () => {
    clearState(STORAGE_KEYS.blackjack)
    clearState(STORAGE_KEYS.rummy)
    clearState(STORAGE_KEYS.cribbage)
    clearState(STORAGE_KEYS.crazyEights)
    clearState(STORAGE_KEYS.roulette)
  }

  /** Leaving a game abandons the hand in progress. */
  const leaveGame = () => {
    clearGames()
    setState(current => ({ ...current, gameId: null }))
  }

  const editPlayers = () => {
    clearGames()
    setState(current => ({ ...current, gameId: null, editingPlayers: true }))
  }

  if (editingPlayers) {
    return (
      <div id="app">
        <PlayerSetup
          players={players}
          onConfirm={confirmed => setState({ players: confirmed, editingPlayers: false, gameId: null })}
        />
      </div>
    )
  }

  return (
    <div id="app">
      {game === null ? (
        <GameSelect
          players={players}
          onSelect={selected => setState(current => ({ ...current, gameId: selected.id }))}
          onEditPlayers={editPlayers}
        />
      ) : game.id === 'blackjack' ? (
        <Blackjack players={players} onSettle={settle} onExit={leaveGame} />
      ) : game.id === 'rummy' ? (
        <Rummy players={players} onExit={leaveGame} />
      ) : game.id === 'cribbage' ? (
        <Cribbage players={players} onExit={leaveGame} />
      ) : game.id === 'crazy-eights' ? (
        <CrazyEights players={players} onExit={leaveGame} />
      ) : game.id === 'roulette' ? (
        <Roulette players={players} onSettle={settle} onExit={leaveGame} />
      ) : (
        <main className="view-game-placeholder">
          <h2>{game.name}</h2>
          <p>This game hasn't been built yet.</p>
          <button type="button" className="btn-primary" onClick={leaveGame}>
            Back to games
          </button>
        </main>
      )}
    </div>
  )
}

export default App
