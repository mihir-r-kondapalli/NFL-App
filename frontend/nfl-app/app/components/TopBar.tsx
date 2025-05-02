'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function TopBar(): React.ReactElement {
  const router = useRouter()
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const navigateTo = (path: string): void => {
    router.push(path)
    setMenuOpen(false)
  }

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const menuItems = (
    <>
      <MenuLink text="Rankings" path="/rankings" onClick={navigateTo} />
      <MenuLink text="Timelines" path="/timeline" onClick={navigateTo} />
      <MenuLink text="Expected Points" path="/eps" onClick={navigateTo} />
      <MenuLink text="Strategy" path="/decisions" onClick={navigateTo} />
      <MenuLink text="Simulate" path="/simulate" onClick={navigateTo} />
      <MenuLink text="Play" path="/play" onClick={navigateTo} />
      <MenuLink text="Deep Dive" path="/about" onClick={navigateTo} />
      <MenuLink text="About Me" path="/contact" onClick={navigateTo} />
    </>
  )

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

        {isMobile ? (
          <div style={{ position: 'relative' }}>
            <button
              className={`hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="Toggle Menu"
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '40px',
                backgroundColor: '#003300',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {menuItems}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '16px' }}>
            {menuItems}
          </div>
        )}
      </nav>

      {/* Hamburger animation styles */}
      <style jsx>{`
        .hamburger {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px;
          z-index: 1100;
        }

        .hamburger span {
          display: block;
          width: 24px;
          height: 2px;
          background-color: white;
          transition: all 0.3s ease;
          transform-origin: center;
        }

        .hamburger.open span:nth-child(1) {
          transform: rotate(45deg);
          position: absolute;
        }

        .hamburger.open span:nth-child(2) {
          opacity: 0;
        }

        .hamburger.open span:nth-child(3) {
          transform: rotate(-45deg);
          position: absolute;
        }
      `}</style>
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
        textAlign: 'left',
        transition: 'background-color 0.2s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#005500'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {text}
    </button>
  )
}
