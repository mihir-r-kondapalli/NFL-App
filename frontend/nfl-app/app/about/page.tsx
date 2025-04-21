'use client'

import TopBar from "../components/TopBar"

export default function About() {
  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#111',
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

        {/* --- Project Overview --- */}
        <section>
          <h1 style={{ fontSize: '2.5rem', color: '#00cc66' }}>
            About 4th & Sim
          </h1>
          <p style={{ fontSize: '18px', color: '#ccc', lineHeight: '1.6', maxWidth: '800px', marginTop: '16px' }}>
            <strong>4th & Sim</strong> is a football simulation and analytics platform built around expected points, team strategy, and dynamic decision-making. 
            It blends real NFL data with interactive game flow, allowing users to simulate drives, visualize field position value, and explore strategic outcomes.
          </p>
          <p style={{ fontSize: '18px', color: '#ccc', lineHeight: '1.6', marginTop: '12px' }}>
            The data was collected using the insanely comprehensive <strong>nflfastR</strong> package.
            The system is powered by team-specific distributions, a fast game engine, and intuitive visualizations — designed to make playcalling and decision modeling more accessible and fun.
          </p>
        </section>

        {/* --- About Me --- */}
        <section>
          <h2 style={{ fontSize: '2rem', color: '#00aa55' }}>
            About Me
          </h2>
          <p style={{ fontSize: '18px', color: '#bbb', lineHeight: '1.6', maxWidth: '700px', marginTop: '12px' }}>
            I'm Mihir Kondapalli, a Computer Science student at UCSB. I love building tools that bring data to life — from exoplanet imaging pipelines to football strategy engines.
            This project combines my passion for sports, simulation, and beautiful interfaces.
          </p>
        </section>

        {/* --- Contact Info --- */}
        <section>
          <h2 style={{ fontSize: '2rem', color: '#00aa55' }}>
            Get in Touch
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '18px', color: '#ccc', marginTop: '12px' }}>
            <li style={{ marginBottom: '10px' }}>
              Email: <a href="mailto:mihir.kondapalli@gmail.com" style={linkStyle}>mihir.kondapalli@gmail.com</a>
            </li>
            <li style={{ marginBottom: '10px' }}>
              LinkedIn: <a href="https://linkedin.com/in/mihirkondapalli" target="_blank" rel="noreferrer" style={linkStyle}>linkedin.com/in/mihirkondapalli</a>
            </li>
            <li>
              GitHub: <a href="https://github.com/mihir-r-kondapalli" target="_blank" rel="noreferrer" style={linkStyle}>github.com/mihirkondapalli</a>
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
