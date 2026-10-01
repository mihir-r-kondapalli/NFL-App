import type { Drive } from './bracket-layout'
import styles from './report.module.css'

const position = (yards: number) => 10 + Math.max(0, Math.min(100, 100 - yards))
function label(yards: number, opponent: string) {
  if (yards === 100) return 'Own goal line'
  if (yards === 0) return `${opponent} goal line`
  if (yards === 50) return 'Midfield'
  return yards > 50 ? `Own ${100 - yards}` : `${opponent} ${yards}`
}
export default function DriveField({ drive, opponent }: { drive: Drive; opponent: string }) {
  const start = position(drive.start_yards_to_goal)
  const end = drive.end_yards_to_goal === undefined ? undefined : position(drive.end_yards_to_goal)
  const kick = drive.kick_end_yards_to_goal === undefined ? undefined : position(drive.kick_end_yards_to_goal)
  const description = `Start: ${label(drive.start_yards_to_goal, opponent)}. ${end === undefined ? 'End position not recorded.' : `${drive.result || 'End'}: ${label(drive.end_yards_to_goal!, opponent)}.`}${kick === undefined ? '' : ` Punt possession: ${label(drive.kick_end_yards_to_goal!, opponent)}.`}`
  return <div className={styles.field}>
    <svg viewBox="0 0 120 36" role="img" aria-label={description}>
      <rect x="10" y="10" width="100" height="16" rx="1" fill="#153c28" stroke="#668774" strokeWidth="0.3" />
      {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={10 + i * 10} x2={10 + i * 10} y1="10" y2="26" stroke="#72917e" strokeWidth="0.25" /><text x={10 + i * 10} y="31" textAnchor="middle" fill="#bfd0c5" fontSize="2.7">{i * 10}</text></g>)}
      <text x="10" y="6" fill="#bfd0c5" fontSize="3">{drive.team} goal</text><text x="110" y="6" textAnchor="end" fill="#bfd0c5" fontSize="3">{opponent} goal →</text>
      {end !== undefined && <line x1={start} x2={end} y1="18" y2="18" stroke="#a4e8ac" strokeWidth="1.7" />}
      {kick !== undefined && end !== undefined && <><path d={`M ${end} 18 Q ${(end + kick) / 2} 1 ${kick} 18`} fill="none" stroke="#e8c979" strokeWidth="0.7" strokeDasharray="1.5 1" /><path d={`M ${kick} 15 L ${kick + 2} 18 L ${kick} 21 L ${kick - 2} 18 Z`} fill="#e8c979" /></>}
      <circle cx={start} cy="18" r="1.8" fill="#0b2015" stroke="#d6fce0" strokeWidth="0.65" />
      {end !== undefined && <rect x={end - 1.4} y="16.6" width="2.8" height="2.8" fill="#a4e8ac" stroke="#0b2015" strokeWidth="0.3" />}
    </svg>
    <div className={styles.fieldLegend}><span>○ Start: {label(drive.start_yards_to_goal, opponent)}</span><span>■ {drive.result || 'End'}: {end === undefined ? 'Not recorded' : label(drive.end_yards_to_goal!, opponent)}</span>{kick !== undefined && <span>◆ Punt possession: {label(drive.kick_end_yards_to_goal!, opponent)}</span>}</div>
  </div>
}
