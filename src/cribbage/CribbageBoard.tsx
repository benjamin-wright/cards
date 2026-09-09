type CribbageBoardProps = {
  player1Name: string
  player2Name: string
  player1Score: number
  player2Score: number
  player1PrevScore?: number
  player2PrevScore?: number
  targetScore?: number
}

function getHoleCoords(s: number): { x: number; y: number } {
  if (s <= 0) {
    return { x: 85, y: 565 }
  }
  if (s >= 121) {
    return { x: 215, y: 565 }
  }

  if (s <= 60) {
    const sPrime = s - 1
    const b = Math.floor(sPrime / 5)
    const k = sPrime % 5
    const y = 525 - (b * 36 + k * 5.5)
    return { x: 85, y }
  }

  const sPrime = s - 61
  const b = Math.floor(sPrime / 5)
  const k = sPrime % 5
  const y = 103 + (b * 36 + k * 5.5)
  return { x: 215, y }
}

export default function CribbageBoard({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1PrevScore = 0,
  player2PrevScore = 0,
  targetScore = 121,
}: CribbageBoardProps) {
  const p1Score = Math.min(Math.max(0, player1Score), targetScore)
  const p2Score = Math.min(Math.max(0, player2Score), targetScore)
  const p1Prev = Math.min(Math.max(0, player1PrevScore), targetScore)
  const p2Prev = Math.min(Math.max(0, player2PrevScore), targetScore)

  // Generate all 120 holes + start/finish
  const holes: { s: number; x: number; y: number; label?: number }[] = []

  // Start (0)
  holes.push({ s: 0, x: 85, y: 565 })

  // 1 to 120
  for (let s = 1; s <= 120; s += 1) {
    const coords = getHoleCoords(s)
    holes.push({
      s,
      x: coords.x,
      y: coords.y,
      label: s % 5 === 0 ? s : undefined,
    })
  }

  // Finish (121)
  holes.push({ s: 121, x: 215, y: 565 })

  const p1Pos = getHoleCoords(p1Score)
  const p2Pos = getHoleCoords(p2Score)
  const p1PrevPos = getHoleCoords(p1Prev)
  const p2PrevPos = getHoleCoords(p2Prev)

  const showP1Prev = p1Prev > 0 && p1Prev !== p1Score
  const showP2Prev = p2Prev > 0 && p2Prev !== p2Score

  return (
    <div className="cribbage-board-wrapper">
      <svg
        className="cribbage-board-svg"
        viewBox="0 0 300 630"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Cribbage board: ${player1Name} has ${player1Score} points, ${player2Name} has ${player2Score} points`}
      >
        <defs>
          {/* Wood board gradient */}
          <linearGradient id="wood-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3d2716" />
            <stop offset="50%" stopColor="#2c1b0e" />
            <stop offset="100%" stopColor="#1e1208" />
          </linearGradient>

          {/* Board bevel border */}
          <linearGradient id="bevel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6e4727" />
            <stop offset="100%" stopColor="#140a03" />
          </linearGradient>

          {/* Player 1 peg gradient (Gold) */}
          <radialGradient id="p1-peg-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff3a0" />
            <stop offset="40%" stopColor="#f39c12" />
            <stop offset="100%" stopColor="#b7770b" />
          </radialGradient>

          {/* Player 2 peg gradient (Teal) */}
          <radialGradient id="p2-peg-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#a8ffeb" />
            <stop offset="40%" stopColor="#00bc8c" />
            <stop offset="100%" stopColor="#007758" />
          </radialGradient>

          {/* Shadow filter */}
          <filter id="peg-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Outer wood base */}
        <rect x="8" y="8" width="284" height="614" rx="22" fill="url(#bevel-grad)" />
        <rect x="12" y="12" width="276" height="606" rx="18" fill="url(#wood-grad)" stroke="#4a3018" strokeWidth="1.5" />

        {/* Title Engraving */}
        <text x="150" y="38" textAnchor="middle" fill="#8c6239" fontSize="11" fontWeight="bold" letterSpacing="2">
          CRIBBAGE BOARD
        </text>

        {/* Track lines / background channels */}
        {/* Lane 1 channel */}
        <line x1="73" y1="530" x2="73" y2="98" stroke="#1c1108" strokeWidth="10" strokeLinecap="round" opacity="0.6" />
        <line x1="97" y1="530" x2="97" y2="98" stroke="#1c1108" strokeWidth="10" strokeLinecap="round" opacity="0.6" />

        {/* Top curve channel */}
        <path
          d="M 73 98 A 77 77 0 0 1 227 98"
          fill="none"
          stroke="#1c1108"
          strokeWidth="10"
          opacity="0.6"
        />

        {/* Lane 2 channel */}
        <line x1="203" y1="98" x2="203" y2="530" stroke="#1c1108" strokeWidth="10" strokeLinecap="round" opacity="0.6" />
        <line x1="227" y1="98" x2="227" y2="530" stroke="#1c1108" strokeWidth="10" strokeLinecap="round" opacity="0.6" />

        {/* Holes and number labels */}
        {holes.map(h => {
          const p1X = h.x - 12
          const p2X = h.x + 12
          const isSpecial = h.s === 0 || h.s === 121

          return (
            <g key={h.s}>
              {/* P1 hole */}
              <circle cx={p1X} cy={h.y} r={isSpecial ? 3.5 : 2.8} fill="#0d0703" stroke="#4a3018" strokeWidth="0.8" />
              {/* P2 hole */}
              <circle cx={p2X} cy={h.y} r={isSpecial ? 3.5 : 2.8} fill="#0d0703" stroke="#4a3018" strokeWidth="0.8" />

              {/* Number label at 5-hole intervals */}
              {h.label !== undefined && (
                <text
                  x={h.x}
                  y={h.y + 3}
                  textAnchor="middle"
                  fill="#9e7347"
                  fontSize="8"
                  fontWeight="600"
                >
                  {h.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Start / Finish labels */}
        <text x="85" y="582" textAnchor="middle" fill="#8c6239" fontSize="8" fontWeight="bold">
          START
        </text>
        <text x="215" y="582" textAnchor="middle" fill="#8c6239" fontSize="8" fontWeight="bold">
          FINISH
        </text>

        {/* --- PEGS --- */}

        {/* Player 1 Back Peg */}
        {showP1Prev && (
          <circle
            cx={p1PrevPos.x - 12}
            cy={p1PrevPos.y}
            r="4"
            fill="url(#p1-peg-grad)"
            opacity="0.6"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        )}

        {/* Player 2 Back Peg */}
        {showP2Prev && (
          <circle
            cx={p2PrevPos.x + 12}
            cy={p2PrevPos.y}
            r="4"
            fill="url(#p2-peg-grad)"
            opacity="0.6"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        )}

        {/* Player 1 Front Peg */}
        <circle
          cx={p1Pos.x - 12}
          cy={p1Pos.y}
          r="5.5"
          fill="url(#p1-peg-grad)"
          stroke="#ffffff"
          strokeWidth="1.2"
          filter="url(#peg-shadow)"
        />
        <circle cx={p1Pos.x - 13.5} cy={p1Pos.y - 1.5} r="1.5" fill="#ffffff" opacity="0.7" />

        {/* Player 2 Front Peg */}
        <circle
          cx={p2Pos.x + 12}
          cy={p2Pos.y}
          r="5.5"
          fill="url(#p2-peg-grad)"
          stroke="#ffffff"
          strokeWidth="1.2"
          filter="url(#peg-shadow)"
        />
        <circle cx={p2Pos.x + 10.5} cy={p2Pos.y - 1.5} r="1.5" fill="#ffffff" opacity="0.7" />
      </svg>

      {/* Board Legend */}
      <div className="cribbage-board-legend">
        <div className="legend-item legend-item--p1">
          <span className="peg-badge peg-badge--p1" aria-hidden="true" />
          <span className="legend-name">{player1Name || 'Player 1'}</span>
          <span className="legend-score">{player1Score}</span>
        </div>
        <div className="legend-item legend-item--p2">
          <span className="peg-badge peg-badge--p2" aria-hidden="true" />
          <span className="legend-name">{player2Name || 'Player 2'}</span>
          <span className="legend-score">{player2Score}</span>
        </div>
      </div>
    </div>
  )
}
