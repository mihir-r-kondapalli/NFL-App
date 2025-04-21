'use client'

import TopBar from './components/TopBar'
import { useRouter } from 'next/navigation'
import Rankings from './components/ColumnRanking'
import { offenseValues2024, defenseValues2024 } from './data/aep_values'

export default function Home() {
  const router = useRouter()

  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <TopBar />

      {/* Main content container */}
      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
      }}>
        {/* Title + Subtitle */}
        <div style={{ textAlign: 'left' }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px', color: '#007000' }}>
            Welcome to 4th & Sim!
          </h1>
          <p style={{ fontSize: '18px', color: '#999' }}>
            Run full simulations, call plays, and rank teams. Built for strategy lovers and stat-heads alike.
          </p>
        </div>

        {/* Flex container for text + image */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '32px',
            flexWrap: 'wrap', // allows responsiveness on small screens
            justifyContent: 'space-between',
          }}
        >
          {/* Text Section */}
          <div style={{ flex: '1 1 400px', minWidth: '300px' }}>
            <div style={{ fontSize: '18px', lineHeight: '1.7', color: wordColor }}>
              <p style={{ marginBottom: '10px' }}>
              <strong>4th & Sim</strong> is a football simulation and analytics platform built around expected points, team strategy, and dynamic decision-making.
              It blends real NFL data with interactive game flow, allowing users to simulate drives, visualize field position value, and explore
              strategic outcomes. TLDR? It's about <strong>accuracy</strong> and <strong>flexibility</strong>.
              </p>
              <p>
                These NFL rankings are powered by unbiased deep tree search algorithms written in C++ which use play by play data
                from <strong>nflfastR</strong>, allowing precise and powerful measurements of offensive and defensive performance.
                And this is just the beginning of what the engine can do.
              </p>
            </div>
          </div>

          {/* Image */}
          <img
            src="/images/logo.png"
            alt="Logo"
            style={{
              width: 'auto',
              maxWidth: '400px',
              height: 'auto',
              maxHeight: '300px',
              borderRadius: '8px',
              border: '1px solid #333',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
        </div>

        <Rankings year={2024} offenseValues={offenseValues2024} defenseValues={defenseValues2024}/>
      </div>
    </div>
  )
}

const navButton = {
  padding: '12px 24px',
  backgroundColor: '#007000',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '16px',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease-in-out',
}

const wordColor = '#333'