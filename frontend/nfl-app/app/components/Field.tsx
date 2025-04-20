'use client'

import { teamColors } from '../data/team_colors'
import { teamNames } from '../data/team_names'

type FieldProps = {
  team1: string
  team2: string
  score1: number
  score2: number
  loc: number            // Ball position (0–100)
  target: number         // First down marker (0–100)
  down: number
  time: number
  ep1: number
  ep2: number
  possessionIndicator: number  // -1 = Team 1, 1 = Team 2
  no_disp: boolean
}

export default function Field({
  team1,
  team2,
  score1,
  score2,
  loc,
  target,
  down,
  time,
  ep1,
  ep2,
  possessionIndicator,
  no_disp,
}: FieldProps) {
  return (
    <div style={{ width: "100%", textAlign: "center", marginTop: "20px" }}>
      <div
        style={{
          width: "80%",
          height: "200px",
          border: "2px solid black",
          margin: "auto",
          position: "relative",
          background: "green",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left End Zone */}
        <div
          style={{
            width: "10%",
            height: "100%",
            backgroundColor: teamColors[team1]?.primary || '#3709cd',
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: teamColors[team1]?.secondary || 'white',
            fontWeight: "bold",
            writingMode: "vertical-rl",
            fontSize: "18px",
            fontFamily: "monospace",
          }}
        >
          <span style={{transform: "rotate(180deg)"}}>
            {(teamNames[team1] || team1).toUpperCase()}
          </span>
        </div>

        {/* Field Center */}
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((yard, index) => (
            <div
              key={`yard-${yard}-${index}`}
              style={{
                position: "absolute",
                left: `${(index + 1) * 10}%`,
                top: "0",
                height: "100%",
                width: "2px",
                background: "white",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "-8px",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                {yard}
              </span>
            </div>
          ))}

          {Array.from({ length: 99 }, (_, i) => i + 1).map((yard) => (
            <div
              key={`tick-${yard}`}
              style={{
                position: "absolute",
                left: `${yard}%`,
                top: "0",
                height: yard % 5 === 0 ? "10%" : "5%",
                width: "1px",
                background: "white",
                opacity: yard % 5 === 0 ? 0.7 : 0.4,
              }}
            />
          ))}

          {Array.from({ length: 99 }, (_, i) => i + 1).map((yard) => (
            <div
              key={`tick-bottom-${yard}`}
              style={{
                position: "absolute",
                left: `${yard}%`,
                bottom: "0",
                height: yard % 5 === 0 ? "10%" : "5%",
                width: "1px",
                background: "white",
                opacity: yard % 5 === 0 ? 0.7 : 0.4,
              }}
            />
          ))}

          {/* Markers (only shown if no_disp === 0) */}
          {no_disp === false && (
            <>
              {/* Line of Scrimmage */}
              <div
                style={{
                  position: "absolute",
                  left: `${possessionIndicator === 1 ? 100 - loc: loc}%`,
                  top: "0",
                  height: "100%",
                  width: "2px",
                  background: "blue",
                }}
              />

              {/* First Down Line */}
              <div
                style={{
                  position: "absolute",
                  left: `${possessionIndicator === 1 ? 100 - target: target}%`,
                  top: "0",
                  height: "100%",
                  width: "2px",
                  background: "yellow",
                }}
              />

              {/* Ball Marker (Triangle) */}
              <div
                style={{
                  position: 'absolute',
                  left:
                    possessionIndicator === -1
                      ? `calc(${loc}% - 0.5%)`  // nudge to the *left* of LOS
                      : `calc(${100 - loc}% + 0.5%)`, // nudge right when +1
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 0,
                  height: 0,
                  borderTop: '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  // flip the solid side
                  borderLeft:
                    possessionIndicator === 1
                      ? '10px solid brown'          // Team 2 → triangle points RIGHT
                      : '10px solid transparent',
                  borderRight:
                    possessionIndicator === -1
                      ? '10px solid brown'          // Team 1 → triangle points LEFT
                      : '10px solid transparent',
                }}
              />
            </>
          )}
        </div>

        {/* Right End Zone */}
        <div
          style={{
            width: "10%",
            height: "100%",
            backgroundColor: teamColors[team2]?.primary || '#3709cd',
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: teamColors[team2]?.secondary || 'white',
            fontWeight: "bold",
            writingMode: "vertical-rl",
            fontSize: "18px",
            fontFamily: "monospace",
          }}
        >
          {(teamNames[team2] || team2).toUpperCase()}
        </div>
      </div>
    </div>
  )
}
