'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import TopBar from '../components/TopBar'
import MatchupSimulator from './MatchupSimulator'
import SeasonSimulator from '../season/SeasonSimulator'
import styles from './simulation.module.css'

export default function SimulationHub() {
  const router = useRouter()
  const params = useSearchParams()
  const mode = params.get('mode') === 'season' ? 'season' : 'matchup'
  return <div className={styles.hub}>
    <TopBar />
    <nav className={styles.switcher} aria-label="Simulation mode">
      <div><strong>Simulation center</strong><p>One matchup or the whole league.</p></div>
      <div className={styles.modes}>
        <button aria-pressed={mode === 'matchup'} onClick={() => router.replace('/simulate?mode=matchup', { scroll: false })}>Matchup <small>Head-to-head games</small></button>
        <button aria-pressed={mode === 'season'} onClick={() => router.replace('/simulate?mode=season', { scroll: false })}>Full season <small>Standings & playoffs</small></button>
      </div>
    </nav>
    <div hidden={mode !== 'matchup'}><MatchupSimulator /></div>
    <div hidden={mode !== 'season'}><SeasonSimulator /></div>
  </div>
}
