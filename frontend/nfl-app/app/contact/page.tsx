'use client'

import TopBar from "../components/TopBar"

export default function Contact() {
  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#cccccc',
    }}>
      <TopBar />

      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '60px',
      }}>

        {/* --- About Me --- */}
        <section>
          <h1 style={{ fontSize: '2.5rem', color: '#00aa55' }}>
            About Me
          </h1>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '20px' }}>
            I'm Mihir Kondapalli, a second-year honors Computer Science student at UCSB with a passion for copmuter science, physics, sports, data, and for turning complex ideas into intuitive, interactive experiences.
          </p>
        </section>

        {/* --- GRaTeR-JAX Project --- */}
        <section>
          <h2 style={{ fontSize: '2rem', color: '#00aa55' }}>
            Another Project of Mine
          </h2>
          <a 
            href="https://scattered-light-disks.vercel.app" 
            target="_blank" 
            rel="noreferrer"
            style={{ 
              display: 'block',
              backgroundColor: '#2E1A47',
              padding: '24px',
              borderRadius: '12px',
              marginTop: '20px',
              textDecoration: 'none',
              transition: 'transform 0.3s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1.0)'}
          >
            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', color: 'white' }}>
              GRaTeR Image Generator App
            </h3>
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ fontSize: '14px', color: '#ccc', lineHeight: '1.6' }}>
                A tool for astrophysicists and space enthusiasts alike. It builds upon my research at the UCSB Exoplanet Polarimetry Lab
                where I built machine learning frameworks for astonomical phenomena with JAX. Click this box if you want to see some cool
                astronomical images!
              </p>
            </div>
          </a>
        </section>

        {/* --- Project Repo --- */}
        <section>
          <h2 style={{ fontSize: '2rem', color: '#00aa55' }}>
            4th & Sim Project Repository
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '18px', color: wordColor, marginTop: '20px' }}>
            <li>
              GitHub: <a href="https://github.com/mihir-r-kondapalli/NFL-App" target="_blank" rel="noreferrer" style={linkStyle}>github.com/mihir-r-kondapalli/NFL-App</a>
            </li>
          </ul>
        </section>

        {/* --- Contact Info --- */}
        <section>
          <h2 style={{ fontSize: '2rem', color: '#00aa55' }}>
            Get in Touch
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '18px', color: wordColor, marginTop: '12px' }}>
            <li style={{ marginBottom: '10px' }}>
              Email: <a href="mailto:mihir.kondapalli@gmail.com" style={linkStyle}>mihir.kondapalli@gmail.com</a>
            </li>
            <li style={{ marginBottom: '10px' }}>
              LinkedIn: <a href="https://www.linkedin.com/in/mihir-kondapalli/" target="_blank" rel="noreferrer" style={linkStyle}>linkedin.com/in/mihirkondapalli</a>
            </li>
            <li>
              GitHub: <a href="https://github.com/mihir-r-kondapalli" target="_blank" rel="noreferrer" style={linkStyle}>github.com/mihir-r-kondapalli</a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}

const linkStyle = {
  color: '#00cc88',
  textDecoration: 'underline',
}

const wordColor = '#333'