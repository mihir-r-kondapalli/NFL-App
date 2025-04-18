'use client'

import { teamNames } from "../data/team_names"

type ScoreboardProps = {
  team1: string
  team2: string
  score1: number
  score2: number
  time: string
  down: number
  distance: number
  possession: number
}

export default function Scoreboard({
  team1,
  team2,
  score1,
  score2,
  time,
  down,
  distance,
  possession,
}: ScoreboardProps) {
  const downText = `${down} & ${distance}`
  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '18px',
      }}>
        <span>{teamNames[team1]}</span>
        <span>{score1} - {score2}</span>
        <span>{teamNames[team2]}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '16px',
      }}>
        <span>Possession: {possession === 1 ? 'T2' : 'T1'}</span>
        <span>{downText}</span>
        <span>Time: {time}</span>
      </div>
    </>
  )
}
