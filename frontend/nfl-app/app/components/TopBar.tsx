'use client'

import { useRouter } from 'next/navigation'
import { useState, ReactNode } from 'react'

export default function TopBar(): React.ReactElement {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState<boolean>(false)

  const toggleMenu = (): void => {
    setMenuOpen(!menuOpen)
  }

  const navigateTo = (path: string): void => {
    router.push(path)
    setMenuOpen(false)
  }

  return (
    <div style={{
      width: '100%',
      padding: '12px 24px',
      backgroundColor: '#003300',
      borderBottom: '1px solid #555',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'relative',
    }}>
      <button 
        onClick={() => navigateTo('/')} 
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'pointer',
        }}
      >
        <h2 style={{ margin: 0, color: '#19c909' }}>4th&Sim</h2>
      </button>

      {/* Hamburger button */}
      <button 
        onClick={toggleMenu} 
        style={{
          background: 'none',
          border: 'none',
          padding: '8px',
          cursor: 'pointer',
          zIndex: 2,
        }}
      >
        <div style={{
          width: '24px',
          height: '3px',
          backgroundColor: 'white',
          margin: '4px 0',
          transition: 'all 0.3s ease',
          transform: menuOpen ? 'rotate(-45deg) translate(-5px, 6px)' : 'none'
        }}></div>
        <div style={{
          width: '24px',
          height: '3px',
          backgroundColor: 'white',
          margin: '4px 0',
          transition: 'all 0.3s ease',
          opacity: menuOpen ? 0 : 1
        }}></div>
        <div style={{
          width: '24px',
          height: '3px',
          backgroundColor: 'white',
          margin: '4px 0',
          transition: 'all 0.3s ease',
          transform: menuOpen ? 'rotate(45deg) translate(-5px, -6px)' : 'none'
        }}></div>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          backgroundColor: '#003300',
          padding: '12px',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 1,
        }}>
          <MenuButton onClick={() => navigateTo('/rankings')}>Rankings</MenuButton>
          <MenuButton onClick={() => navigateTo('/timeline')}>Timelines</MenuButton>
          <MenuButton onClick={() => navigateTo('/eps')}>Expected Points</MenuButton>
          <MenuButton onClick={() => navigateTo('/simulate')}>Simulate</MenuButton>
          <MenuButton onClick={() => navigateTo('/play')}>Play</MenuButton>
          <MenuButton onClick={() => navigateTo('/about')}>Deep Dive</MenuButton>
          <MenuButton onClick={() => navigateTo('/contact')}>About Me</MenuButton>
        </div>
      )}
    </div>
  )
}

// Reusable menu button component
interface MenuButtonProps {
  children: ReactNode;
  onClick: () => void;
}

function MenuButton({ children, onClick }: MenuButtonProps): React.ReactElement {
  return (
    <button 
      onClick={onClick} 
      style={{
        padding: '8px 16px',
        backgroundColor: '#007000',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      {children}
    </button>
  )
}