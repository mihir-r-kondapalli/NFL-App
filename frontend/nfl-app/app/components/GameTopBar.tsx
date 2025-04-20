'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { teamColors } from '../data/team_colors'

type Props = {
  team1: string
  team2: string
  year1: number
  year2: number
  coach1: string
  coach2: string
  numState: number
  setTeam1: (team: string) => void
  setTeam2: (team: string) => void
  setNumState: (state: number) => void
  resetGame: () => void
  setYear1: (team: number) => void
  setYear2: (team: number) => void
  setCoach1: (team: string) => void
  setCoach2: (team: string) => void
}

export default function GameTopBar({ team1, team2, year1, year2, coach1, coach2, numState, setTeam1, setTeam2, setNumState, resetGame, setYear1, setYear2, setCoach1, setCoach2 }: Props) {
  const router = useRouter()
  const [epEnabled, setEpEnabled] = useState(true)

  const teamOptions = [
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ]

  const yearOptions = [2021, 2022, 2023, 2024]
  const coachOptions = ['Human', 'AI', ...teamOptions]

  return (
    <div style={{
      width: '100%',
      padding: '10px 20px',
      backgroundColor: '#004400',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #666',
      marginBottom: '10px',
      flexWrap: 'wrap',
      gap: '10px'
    }}>

      {/* Team and Coach Selectors */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={labelStyle}>Year 1:</label>
        <select value={year1} onChange={e => setYear1(Number(e.target.value))} style={selectStyle}>
          {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
        </select>

        <label style={labelStyle}>Team 1:</label>
        <select value={team1} onChange={e => setTeam1(e.target.value)} style={{
          ...selectStyle,
          backgroundColor: teamColors[team1]?.primary || '#ffffff',
          color: teamColors[team1]?.secondary || '#000000'
        }}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>

        <label style={labelStyle}>Coach 1:</label>
        <select value={coach1} onChange={e => setCoach1(e.target.value)} style={{
          ...selectStyle,
          backgroundColor: teamColors[coach1]?.primary || '#ffffff',
          color: teamColors[coach1]?.secondary || '#000000'
        }}>
          {coachOptions.map(coach => <option key={coach} value={coach}>{coach}</option>)}
        </select>

        <label style={labelStyle}>Year 2:</label>
        <select value={year2} onChange={e => setYear2(Number(e.target.value))} style={selectStyle}>
          {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
        </select>

        <label style={labelStyle}>Team 2:</label>
        <select value={team2} onChange={e => setTeam2(e.target.value)} style={{
          ...selectStyle,
          backgroundColor: teamColors[team2]?.primary || '#ffffff',
          color: teamColors[team2]?.secondary || '#000000'
        }}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>

        <label style={labelStyle}>Coach 2:</label>
        <select value={coach2} onChange={e => setCoach2(e.target.value)} style={{
          ...selectStyle,
          backgroundColor: teamColors[coach2]?.primary || '#ffffff',
          color: teamColors[coach2]?.secondary || '#000000'
        }}>
          {coachOptions.map(coach => <option key={coach} value={coach}>{coach}</option>)}
        </select>

        <button
          onClick={() => setEpEnabled(!epEnabled)}
          style={{ ...buttonStyle, backgroundColor: epEnabled ? '#007000' : '#555', marginLeft: '12px' }}
        >
          {epEnabled ? 'EP: ON' : 'EP: OFF'}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => resetGame()} style={{ ...buttonStyle, backgroundColor: '#29ad29' }}>Restart</button>
        <button onClick={() => setNumState(0)} style={{ ...buttonStyle, backgroundColor: '#F00' }}>End</button>
        <button onClick={() => router.push('/')} style={buttonStyle}>Home</button>
      </div>
    </div>
  )
}

const buttonStyle = {
  padding: '6px 12px',
  backgroundColor: '#666',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
}

const selectStyle = {
  padding: '4px 8px',
  borderRadius: '4px',
  border: '1px solid #999',
  backgroundColor: '#fff',
  color: '#000',
  fontFamily: 'monospace'
}

const labelStyle = {
  color: 'white',
  fontSize: '14px',
  fontFamily: 'monospace'
} as const
