'use client'

import { useEffect, useState } from 'react'
import PlayoffBracket from './PlayoffBracket'
import GameReport from './GameReport'
import type { BracketGame } from './bracket-layout'
import { DatasetStatus, useDataset } from '../components/DatasetProvider'
import { teamNames } from '../data/team_names'
import styles from './season.module.css'

type Game = BracketGame & { week?: number; location?: string }
type Standing = { team: string; wins: number; losses: number; ties: number; points_for: number; points_against: number; win_pct: number }
type Seed = { team: string; seed: number; division_winner: boolean }
type Result = { season: number; seed: number; games: Game[]; standings: Standing[]; playoffs?: { seeds: Record<string, Seed[]>; games: Game[]; champion: string; notes: string } }
type Job = { id: string; status: string; completed: number; total: number; last_game?: Game; result?: Result; error?: string }
const divisions: Record<string, string[]> = {
  'AFC East': ['BUF', 'MIA', 'NE', 'NYJ'], 'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'], 'AFC West': ['DEN', 'KC', 'LAC', 'LV'],
  'NFC East': ['DAL', 'NYG', 'PHI', 'WAS'], 'NFC North': ['CHI', 'DET', 'GB', 'MIN'],
  'NFC South': ['ATL', 'CAR', 'NO', 'TB'], 'NFC West': ['ARI', 'LAR', 'SEA', 'SF'],
}
const teams = Object.values(divisions).flat().sort()
const divisionOf = (team: string) => Object.keys(divisions).find(d => divisions[d].includes(team)) || ''
async function api<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  const response = await fetch(`/api/season/${path}`, { signal, cache: 'no-store',
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not complete the request.')
  return data
}
function standingsAt(result: Result, week: number): Standing[] {
  const rows = Object.fromEntries(teams.map(team => [team, { team, wins: 0, losses: 0, ties: 0, points_for: 0, points_against: 0, win_pct: 0 }]))
  result.games.filter(g => (g.week || 0) <= week).forEach(g => {
    for (const [team, scored, allowed] of [[g.home_team, g.home_score, g.away_score], [g.away_team, g.away_score, g.home_score]] as [string, number, number][]) {
      const r = rows[team]; r.points_for += scored; r.points_against += allowed
      if (scored > allowed) r.wins++; else if (scored < allowed) r.losses++; else r.ties++
      r.win_pct = (r.wins + r.ties / 2) / (r.wins + r.losses + r.ties)
    }
  })
  return Object.values(rows).sort((a, b) => b.win_pct - a.win_pct || a.team.localeCompare(b.team))
}
function ScoreCard({ game, onSelect }: { game: Game; onSelect: (game: Game) => void }) {
  return <article className={styles.game} role="button" tabIndex={0} aria-label={`View drives: ${game.away_team} at ${game.home_team}`} onClick={() => onSelect(game)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(game) } }}>
    <small>{game.week ? `WEEK ${game.week}` : game.conference} · FINAL{game.overtime ? ' / OT' : ''}</small>
    <div className={game.away_score > game.home_score ? styles.winner : ''}><span>{game.away_seed && <small>#{game.away_seed} </small>}{game.away_team} <small>{game.game_type === 'SB' || game.location === 'Neutral' ? 'NEUTRAL' : 'AWAY'}</small></span><strong>{game.away_score}</strong></div>
    <div className={game.home_score > game.away_score ? styles.winner : ''}><span>{game.home_seed && <small>#{game.home_seed} </small>}{game.home_team} <small>{game.game_type === 'SB' || game.location === 'Neutral' ? 'NEUTRAL' : 'HOME'}</small></span><strong>{game.home_score}</strong></div>
  </article>
}
export default function SeasonSimulator() {
  const dataset = useDataset()
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [season, setSeason] = useState(0)
  const [seed, setSeed] = useState('25')
  const [playoffs, setPlayoffs] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [starting, setStarting] = useState(false)
  const [fetchingSchedule, setFetchingSchedule] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState('')
  const [pollRevision, setPollRevision] = useState(0)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('standings')
  const [week, setWeek] = useState(1)
  const [group, setGroup] = useState('League')
  const [team, setTeam] = useState('')
  const busy = starting || fetchingSchedule || job?.status === 'running'

  useEffect(() => { setResult(null); setError(''); setSelectedGame(null) }, [season])

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const next = await api<Job>(`jobs/${jobId}`, controller.signal)
        setJob(next); setError('')
        if (next.status === 'running') timer = setTimeout(poll, 1000)
        else if (next.status === 'failed') setError(next.error || 'Simulation failed.')
        else if (next.result) {
          setResult(next.result)
          setWeek(Math.max(...next.result.games.map(g => g.week || 1)))
          setTeam(''); setGroup('League'); setTab('standings'); setSelectedGame(null)
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(`${e instanceof Error ? e.message : 'Connection lost.'} The run may still be active. Retry progress while the server is still running.`)
          setJob(current => current ? { ...current, status: 'disconnected' } : null)
        }
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [jobId, season, pollRevision])

  async function loadSchedule() {
    setFetchingSchedule(true); setError(''); setScheduleMessage('')
    try {
      const response = await api<{ games: number }>('schedule', undefined, { season })
      setScheduleMessage(`${response.games} regular-season matchups ready.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load schedule.') }
    finally { setFetchingSchedule(false) }
  }
  async function start() {
    if (busy) return
    setStarting(true); setError(''); setJob(null)
    try {
      const next = await api<Job>('simulate', undefined, { season, seed: Number(seed), playoffs })
      setJob(next)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the simulation.') }
    finally { setStarting(false) }
  }
  if (dataset.loading || dataset.error || !dataset.seasons.length) return <DatasetStatus />
  const weeks = result ? [...new Set(result.games.map(g => g.week || 1))].sort((a, b) => a - b) : []
  const standings = result ? standingsAt(result, week).filter(r => group === 'League' || divisionOf(r.team).startsWith(group)) : []
  const seeds = Object.values(result?.playoffs?.seeds || {}).flat()
  const finalWeek = week === weeks[weeks.length - 1]
  const visibleGames = result?.games.filter(g => g.week === week && (!team || [g.home_team, g.away_team].includes(team))) || []
  const byes = teams.filter(t => !result?.games.some(g => g.week === week && [g.home_team, g.away_team].includes(t)))

  return <><div className={styles.canvas}><main className={styles.page}>
    <header className={styles.hero}><div><p className={styles.eyebrow}>THE ENTIRE LEAGUE. YOUR SEASON.</p><h1>Season simulator</h1><p>Follow every matchup, watch the standings unfold, and crown a champion.</p></div><span className={styles.badge}>32 TEAMS · ONE TROPHY</span></header>
    <section className={styles.panel} aria-label="Season setup">
      <div className={styles.setup}>
        <label>Season<select value={season} disabled={busy} onChange={e => { setSeason(Number(e.target.value)); setJob(null); setScheduleMessage('') }}><option value={0}>Choose a season</option>{dataset.yearOptions.map(y => <option key={y}>{y}</option>)}</select></label>
        <label>Random seed<input type="number" min={0} max={2147483647} step={1} value={seed} disabled={busy} onChange={e => setSeed(e.target.value)} /></label>
        <label className={styles.check}><input type="checkbox" checked={playoffs} disabled={busy} onChange={e => setPlayoffs(e.target.checked)} /> Include playoffs</label>
        <button className={styles.primary} disabled={busy || !season || dataset.teamsFor(season).length !== 32 || seed === '' || !Number.isInteger(Number(seed)) || Number(seed) < 0 || Number(seed) > 2147483647} onClick={start}>{busy ? 'Simulating…' : 'Simulate season →'}</button>
      </div>
      <p className={styles.hint}>Use the same seed to replay a season, or change it for a different outcome. All 32 teams and a cached schedule are required. Results stay in this session and are not saved.</p>
      {!!season && dataset.teamsFor(season).length !== 32 && <p role="status">This dataset has {dataset.teamsFor(season).length} teams. Build all 32 to simulate a full season.</p>}
      <div className={styles.schedule}><button disabled={!season || busy} onClick={loadSchedule}>{fetchingSchedule ? 'Loading schedule…' : 'Load season schedule'}</button><span role="status">{scheduleMessage || 'Load the actual matchups once before your first run.'}</span></div>
      {job && <div className={styles.progress} role="status" aria-live="polite"><div><strong>{job.status === 'complete' ? 'Season complete' : job.status === 'failed' ? 'Simulation failed' : job.status === 'disconnected' ? 'Progress unavailable' : 'Season in progress'}</strong><span>{job.completed} / {job.total} games</span></div><progress value={job.completed} max={job.total} />{job.last_game && <small>Latest: {job.last_game.away_team} {job.last_game.away_score} — {job.last_game.home_team} {job.last_game.home_score}</small>}</div>}
      {job?.status === 'disconnected' && <button onClick={() => setPollRevision(v => v + 1)}>Retry progress</button>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
    {!result && <section className={styles.empty}><h2>Your league story starts here.</h2><p>Run a season to explore standings, weekly scores, and the road to the Super Bowl.</p>{!!season && <p>Start by loading the {season} schedule above.</p>}</section>}
    {result && <>
      <section className={styles.summary}><div><small>SEASON</small><strong>{result.season}</strong></div><div><small>REGULAR-SEASON GAMES</small><strong>{result.games.length}</strong></div><div><small>SIMULATION SEED</small><strong>{result.seed}</strong></div><div><small>{result.playoffs ? 'SUPER BOWL CHAMPION' : 'BEST RECORD'}</small><strong>{result.playoffs?.champion || result.standings[0]?.team}</strong></div></section>
      <div className={styles.toolbar}><div className={styles.tabs} role="group" aria-label="Results view">{['standings', 'scores', ...(result.playoffs ? ['playoffs'] : [])].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'scores' ? 'Week by week' : t[0].toUpperCase() + t.slice(1)}</button>)}</div></div>
      {tab !== 'playoffs' && <div className={styles.filters}><label>Through week<select value={week} onChange={e => setWeek(Number(e.target.value))}>{weeks.map(w => <option key={w} value={w}>Week {w}{w === weeks[weeks.length - 1] ? ' · Final standings' : ''}</option>)}</select></label>{tab === 'standings' ? <label>View<select value={group} onChange={e => setGroup(e.target.value)}>{['League', 'AFC', 'NFC', ...Object.keys(divisions)].map(g => <option key={g}>{g}</option>)}</select></label> : <label>Team<select value={team} onChange={e => setTeam(e.target.value)}><option value="">All teams</option>{teams.map(t => <option key={t} value={t}>{teamNames[t] || t}</option>)}</select></label>}<div className={styles.weekNav}><button disabled={week === weeks[0]} onClick={() => setWeek(weeks[weeks.indexOf(week) - 1])}>← Previous</button><button disabled={finalWeek} onClick={() => setWeek(weeks[weeks.indexOf(week) + 1])}>Next →</button></div></div>}
      {tab === 'standings' && <section className={styles.panel}><h2>{group} standings <small>· Week {week}</small></h2><p className={styles.hint}>Sorted by win percentage, then team abbreviation. {finalWeek && result.playoffs ? 'Seed badges show final playoff qualification.' : 'Playoff seeds are shown only after the final week.'}</p><div className={styles.tableWrap}><table><thead><tr>{['Team', 'W', 'L', 'T', 'PCT', 'PF', 'PA', 'DIFF'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{standings.map(r => { const qualified = finalWeek && seeds.find(s => s.team === r.team); return <tr key={r.team}><th scope="row"><button className={styles.teamLink} onClick={() => { setTeam(r.team); setTab('scores') }}>{r.team}</button> <span className={styles.teamName}>{teamNames[r.team]}</span>{qualified && <span className={styles.seed}>#{qualified.seed}{qualified.division_winner ? ' DIV' : ' WC'}</span>}</th><td>{r.wins}</td><td>{r.losses}</td><td>{r.ties}</td><td>{r.win_pct.toFixed(3)}</td><td>{r.points_for}</td><td>{r.points_against}</td><td className={r.points_for >= r.points_against ? styles.positive : ''}>{r.points_for > r.points_against ? '+' : ''}{r.points_for - r.points_against}</td></tr> })}</tbody></table></div></section>}
      {tab === 'scores' && <section><h2>Week {week} {team && `· ${teamNames[team] || team}`}</h2><div className={styles.scoreGrid}>{visibleGames.map(g => <ScoreCard key={g.game_id} game={g} onSelect={setSelectedGame} />)}</div>{!visibleGames.length && <div className={styles.empty}>{team} has a bye this week.</div>}{!team && byes.length > 0 && <p className={styles.hint}>On bye: {byes.join(' · ')}</p>}{team && <><h2 className={styles.spaced}>Full {team} schedule</h2><div className={styles.scoreGrid}>{result.games.filter(g => [g.home_team, g.away_team].includes(team)).map(g => <ScoreCard key={g.game_id} game={g} onSelect={setSelectedGame} />)}</div></>}</section>}
      {tab === 'playoffs' && result.playoffs && <section><div className={styles.champion}><p className={styles.eyebrow}>SUPER BOWL CHAMPION</p><h2>{teamNames[result.playoffs.champion] || result.playoffs.champion}</h2><p>The final team standing.</p></div><div className={styles.conferences}>{Object.entries(result.playoffs.seeds).map(([conf, entries]) => <div className={styles.panel} key={conf}><h2>{conf} seeds</h2><ol className={styles.seedList}>{entries.map(s => <li key={s.team}><strong>{s.team}</strong><span>{s.division_winner ? 'Division winner' : 'Wild card'}{s.seed <= (result.season >= 2020 ? 1 : 2) ? ' · Bye' : ''}</span></li>)}</ol></div>)}</div><PlayoffBracket games={result.playoffs.games} seeds={result.playoffs.seeds} onSelect={setSelectedGame} /><p className={styles.hint}>Net-touchdown tiebreakers are unavailable; unresolved ties use a reproducible seeded draw.</p></section>}
    </>}
  {selectedGame && <GameReport game={selectedGame} onClose={() => setSelectedGame(null)} />}
  </main></div></>
}
