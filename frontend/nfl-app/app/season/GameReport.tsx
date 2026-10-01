'use client'

import { useEffect, useRef } from 'react'
import type { BracketGame, Drive } from './bracket-layout'
import styles from './report.module.css'
import DriveField from './DriveField'

function startingYardLine(drive: Drive, game: BracketGame) {
  const yards = drive.start_yards_to_goal
  if (yards === 50) return 'Midfield (50)'
  if (yards > 50) return `Own ${100 - yards}`
  const opponent = drive.team === game.home_team ? game.away_team : game.home_team
  return `${opponent} ${yards}`
}

export default function GameReport({ game, onClose }: { game: BracketGame; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close() }, [])
  return <dialog ref={dialog} className={styles.dialog} onClick={event => {
    if (event.target !== event.currentTarget) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
  }} onClose={() => {
    // Strict Mode closes and reopens the dialog during effect replay. Its queued
    // close event must not dismiss the newly reopened report.
    if (!dialog.current?.open) onClose()
  }} aria-labelledby="drive-report-title">
    <header className={styles.header}><div><p>GAME REPORT</p><h2 id="drive-report-title">{game.away_team} {game.away_score} — {game.home_team} {game.home_score}</h2><span>Drive by drive{game.overtime ? ' · Overtime' : ''}</span></div><button autoFocus onClick={onClose} aria-label="Close game report">Close ×</button></header>
    {!game.drives?.length ? <div className={styles.empty}><h3>No drive report recorded</h3><p>This saved game contains its final score but no drive history. New season simulations save a report for every game. Run a new season to get drive details.</p></div> : <>
      <p className={styles.hint}>Expand a drive to see its plays. Scores are shown as {game.away_team} – {game.home_team}.</p>
      {game.drives.map(d => <details className={styles.drive} key={d.number}><summary><div><strong>#{d.number} · {d.team}</strong><span>{d.start} → {d.end}</span><span>{d.plays} plays · Start: {startingYardLine(d, game)}</span></div><div><strong>{d.away_score} – {d.home_score}</strong><span>{d.outcome}</span></div><div className={styles.fieldWrap}><DriveField drive={d} opponent={d.team === game.home_team ? game.away_team : game.home_team} /></div></summary><ol>{d.events.map((event, i) => <li key={i}><time>{event.clock}</time><p>{event.message}</p><span>{event.away_score} – {event.home_score}</span></li>)}</ol></details>)}
    </>}
  </dialog>
}
