'use client'

import { useRouter } from 'next/navigation'

export default function TopBar() {
  const router = useRouter()

  return (
    <div style={{
      width: '100%',
      padding: '12px 24px',
      backgroundColor: '#003300',
      borderBottom: '1px solid #555',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <button onClick={() => router.push('/')} style={{background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',}}>
        <h2 style={{ margin: 0, color: '#19c909' }}>4th&Sim</h2></button>

      <div style={{ display: 'flex', gap: '12px' }}>
      <button onClick={() => router.push('/rankings')} style={navButtonStyle}>Rankings</button>
      <button onClick={() => router.push('/timeline')} style={navButtonStyle}>Timelines</button>
      <button onClick={() => router.push('/eps')} style={navButtonStyle}>Expected Points</button>
      <button onClick={() => router.push('/simulate')} style={navButtonStyle}>Simulate</button>
      <button onClick={() => router.push('/play')} style={navButtonStyle}>Play</button>
      </div>
    </div>
  )
}

const navButtonStyle = {
  padding: '8px 16px',
  backgroundColor: '#007000',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  cursor: 'pointer',
}
