'use client'

type ScoreboardProps = {
  score1: number
  score2: number
  time: string
  down: number
  distance: number
  possession: number
}

export default function Scoreboard({
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
        <span>Team 1</span>
        <span>{score1} - {score2}</span>
        <span>Team 2</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '16px',
      }}>
        <span>Time: {time}</span>
        <span>{downText}</span>
        <span>Possession: {possession === 1 ? 'T2' : 'T1'}</span>
      </div>
    </>
  )
}
