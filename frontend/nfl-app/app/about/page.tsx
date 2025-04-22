'use client'

import TopBar from "../components/TopBar"
import Image from 'next/image'

export default function About() {
  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#fff',
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
          <h1 style={{ fontSize: '2.5rem', color: '#00aa55' }}>
            A Deep Dive into 4th & Sim
          </h1>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', maxWidth: '800px', marginTop: '16px' }}>
            <strong>4th & Sim</strong> is a football simulation and analytics platform built around expected points, team strategy, and dynamic decision-making. 
            It blends real NFL data with interactive game flow, allowing users to simulate drives, visualize field position value, and explore strategic outcomes.
            TLDR? It's about <strong>accuracy</strong> and <strong>flexibility</strong>.
          </p>

          <h2 style={{ fontSize: '2rem', color: '#00aa55', marginTop: '30px' }}> Collecting the Data</h2>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            The data was collected using the insanely comprehensive <strong>nflfastR</strong> package. Various statistical methods were applied to fill in the missing
            data and for coelescing and compressing all of the data into a manageable packet. This packet contains distributions of all the play outcomes, the decisions of
            each of the coaches, and the same for defense.
          </p>

          <h2 style={{ fontSize: '2rem', color: '#00aa55', marginTop: '30px' }}> A New Expected Points Model </h2>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            The NFL Expected Points Metric is inherently flawed.
          </p>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '10px' }}>
            - It is overreliant on league wide data. It treats teams like the 2024 Detroit Lions the same as the 2017 Cleveland Browns. Finding the expected points of
            an individual team is impossible with traditional metrics. EPA/play does not fix this as it itself depends on the NFL EP model.
          </p>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '10px' }}>
            - The metric also ignores the strength of the defense, the EP values are too static to handle matchups.
          </p>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '10px' }}>
            - It artificially smooths over edge cases by applying linear of GAM models that morph the metric to seem more aesthetically pleasing, ignoring real
            outliers and data points that are just as important.
          </p>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            <strong>My Expected Points Model</strong> fixes a lot of these issues by using real, individual play distributions and play decisions. It uses dynamic programming
            algorithms to generate accurate EP values for individual offenses and defenses.
          </p>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            These algorithms were written in <strong>C++</strong> for speed.
          </p>

          <h3 style={{ fontSize: '1.25rem', color: '#00aa55', marginTop: '30px', marginBottom: '16px' }}> NFL Expected Points vs 4th&Sim Expected Points </h3>
          <Image
            src="/images/chart.png"   // No import needed
            alt="NFL EP Chart"
            width={800}
            height={500}
          />

          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '20px' }}>
            The 4th & Sim expected points model is able to match the
            NFL EP Metric league-wide while also providing accurate team-by-team offense and defense metrics.
          </p>

          <h3 style={{ fontSize: '1.25rem', color: '#00aa55', marginTop: '30px' }}> Pytorch </h3>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            After building the game engine, I trained a pytorch reinforcement learning agent that is included in the
            <strong> Play</strong> section. Playing on league average play data, it wins about 55% of the time against
            league average teams.
          </p>

          <h3 style={{ fontSize: '1.25rem', color: '#00aa55', marginBottom: '20px', marginTop: '30px'}}>
            Powered By Modern Infrastructure
          </h3>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6'}}>
            4th & Sim runs on a reliable and scalable stack built with <strong>AWS</strong> (FastAPI) for computing and cloud processing,
            <strong> Supabase</strong> (PostgreSQL) for real-time database management, and <strong>Vercel</strong> (React NextJS)
            for fast and seamless deployment.
          </p>

          <h2 style={{ fontSize: '2.5rem', color: '#00aa55', marginTop: '40px' }}> Overall </h2>
          <p style={{ fontSize: '18px', color: wordColor, lineHeight: '1.6', marginTop: '16px' }}>
            The 4th & Sim football engine presents a new way of analyzing sports as a whole, where we can break down the sport by modeling it from the ground
            up rather from the top down.
          </p>
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
