import { useCallback } from 'react'
import GameSelect from './views/GameSelect'
import PlayerSetup from './views/PlayerSetup'
import Blackjack from './blackjack/Blackjack'
import Rummy from './rummy/Rummy'
import Cribbage from './cribbage/Cribbage'
import CrazyEights from './crazyeights/CrazyEights'
import Roulette from './roulette/Roulette'
import { games } from './games'
import { deviceGate, useDeviceView } from './orientation'
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

function TableGame({
  gameId,
  players,
  onSettle,
  onExit,
}: {
  gameId: string
  players: Player[]
  onSettle: (results: Settlement[]) => void
  onExit: () => void
}) {
  const { tilt, tiltAccess, portrait, enable } = useDeviceView()
  const gate = deviceGate(portrait, tiltAccess)
  const blocked = gate !== null

  return (
    <>
      <div className="table-game" inert={blocked} aria-hidden={blocked}>
        {gameId === 'rummy' ? (
          <Rummy players={players} tilt={tilt} onExit={onExit} />
        ) : gameId === 'cribbage' ? (
          <Cribbage players={players} tilt={tilt} onExit={onExit} />
        ) : gameId === 'crazy-eights' ? (
          <CrazyEights players={players} tilt={tilt} onExit={onExit} />
        ) : (
          <Roulette players={players} tilt={tilt} onSettle={onSettle} onExit={onExit} />
        )}
      </div>
      {blocked && (
        <div className="device-gate" role="dialog" aria-modal="true" aria-labelledby="device-gate-title">
          {gate === 'orientation' ? (
            <>
              <h1 id="device-gate-title">Turn your device upright and lock the orientation</h1>
              <p>Keep the screen in portrait so you can tilt the device towards each player.</p>
            </>
          ) : tiltAccess === 'checking' ? (
            <>
              <h1 id="device-gate-title">Checking device tilt…</h1>
              <p>Move your device slightly to check its motion sensor.</p>
            </>
          ) : (
            <>
              <h1 id="device-gate-title">Tilt access needed</h1>
              <p>
                {tiltAccess === 'unavailable'
                  ? 'No tilt reading was received. Check your browser settings or try again.'
                  : 'Tap below to allow motion access and play using device tilt.'}
              </p>
              <button type="button" className="btn-primary" onClick={enable}>
                {tiltAccess === 'unavailable' ? 'Try tilt again' : 'Allow tilt access'}
              </button>
            </>
          )}
          <button type="button" className="btn-secondary" onClick={onExit}>
            Back to games
          </button>
        </div>
      )}
    </>
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
      ) : ['rummy', 'cribbage', 'crazy-eights', 'roulette'].includes(game.id) ? (
        <TableGame gameId={game.id} players={players} onSettle={settle} onExit={leaveGame} />
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
