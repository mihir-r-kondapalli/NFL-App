'use client'

import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

export default function TopBar(): React.ReactElement {
  const router = useRouter()

  const navigateTo = (path: string): void => {
    router.push(path)
  }

  return (
    <header style={{
      width: '100%',
      backgroundColor: '#003300',
      borderBottom: '1px solid #444',
      padding: '12px 24px',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <nav style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <button
          onClick={() => navigateTo('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#19c909',
            fontSize: '20px',
            fontWeight: 700,
          }}
        >
          4th&Sim
        </button>

        {/* Menu Items */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <MenuLink text="Rankings" path="/rankings" onClick={navigateTo} />
          <MenuLink text="Timelines" path="/timeline" onClick={navigateTo} />
          <MenuLink text="Expected Points" path="/eps" onClick={navigateTo} />
          <MenuLink text="Strategy" path="/decisions" onClick={navigateTo} />
          <MenuLink text="Simulate" path="/simulate" onClick={navigateTo} />
          <MenuLink text="Play" path="/play" onClick={navigateTo} />
          <MenuLink text="Deep Dive" path="/about" onClick={navigateTo} />
          <MenuLink text="About Me" path="/contact" onClick={navigateTo} />
        </div>
      </nav>
    </header>
  )
}

interface MenuLinkProps {
  text: string
  path: string
  onClick: (path: string) => void
}

function MenuLink({ text, path, onClick }: MenuLinkProps): React.ReactElement {
  return (
    <button
      onClick={() => onClick(path)}
      style={{
        background: 'none',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '6px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '15px',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#005500'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {text}
    </button>
  )
}