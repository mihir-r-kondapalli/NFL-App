'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function GameTopBar() {
  const router = useRouter()

  const [team1, setTeam1] = useState('NFL')
  const [team2, setTeam2] = useState('NFL')
  const [coach1, setCoach1] = useState('Human')
  const [coach2, setCoach2] = useState('NFL')
  const [epEnabled, setEpEnabled] = useState(true)

  const teamOptions = [
    'NFL', 'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ]

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
        <label style={labelStyle}>Team 1:</label>
        <select value={team1} onChange={e => setTeam1(e.target.value)} style={selectStyle}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>

        <label style={labelStyle}>Coach 1:</label>
        <select value={coach1} onChange={e => setCoach1(e.target.value)} style={selectStyle}>
          {coachOptions.map(coach => <option key={coach} value={coach}>{coach}</option>)}
        </select>

        <label style={labelStyle}>Team 2:</label>
        <select value={team2} onChange={e => setTeam2(e.target.value)} style={selectStyle}>
          {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
        </select>

        <label style={labelStyle}>Coach 2:</label>
        <select value={coach2} onChange={e => setCoach2(e.target.value)} style={selectStyle}>
          {coachOptions.map(coach => <option key={coach} value={coach}>{coach}</option>)}
        </select>

        <button
          onClick={() => setEpEnabled(!epEnabled)}
          style={{ ...buttonStyle, backgroundColor: epEnabled ? '#007000' : '#555' }}
        >
          {epEnabled ? 'EP: ON' : 'EP: OFF'}
        </button>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => alert('Game not implemented yet')} style={{ ...buttonStyle, backgroundColor: '#282899' }}>Play</button>
        <button onClick={() => alert('Restart not implemented yet')} style={{ ...buttonStyle, backgroundColor: '#29ad29' }}>Restart</button>
        <button onClick={() => alert('End not implemented yet')} style={{ ...buttonStyle, backgroundColor: '#F00' }}>End</button>
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
