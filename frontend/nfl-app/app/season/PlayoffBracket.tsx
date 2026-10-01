import { bracketLayout, BRACKET_HEIGHT, BRACKET_WIDTH, CARD_HEIGHT, CARD_WIDTH, BracketGame, BracketSeed, winner } from './bracket-layout'
import styles from './bracket.module.css'

export default function PlayoffBracket({ games, seeds, onSelect }: { games: BracketGame[]; seeds: Record<string, BracketSeed[]>; onSelect: (game: BracketGame) => void }) {
  const { nodes, edges } = bracketLayout(games, seeds)
  return <section aria-label="Playoff bracket" className={styles.section}>
    <h2>Road to the Super Bowl</h2>
    <p>Each conference reseeds after every round: the highest remaining seed hosts the lowest remaining seed. Lines show the matchups from this simulation, not fixed future opponents. Scroll horizontally to explore both conferences.</p>
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Scrollable AFC and NFC playoff bracket">
      <div className={styles.bracket} style={{ width: BRACKET_WIDTH, height: BRACKET_HEIGHT }}>
        <div className={styles.afc}>AFC</div><div className={styles.nfc}>NFC</div>
        {['Wild-Card / Byes', 'Divisional', 'AFC Championship', 'Super Bowl', 'NFC Championship', 'Divisional', 'Wild-Card / Byes'].map((label, i) => <div key={i} className={styles.round} style={{ left: i * 270, width: CARD_WIDTH }}>{label}</div>)}
        {[270, 540, 1080, 1350].map(x => <div key={x} className={styles.reseed} style={{ left: x, width: CARD_WIDTH }}>Highest remaining vs. lowest</div>)}
        <svg width={BRACKET_WIDTH} height={BRACKET_HEIGHT} className={styles.lines} aria-hidden="true">
          {edges.map(edge => {
            const from = nodes.find(n => n.id === edge.from)!
            const to = nodes.find(n => n.id === edge.to)!
            const right = to.x > from.x
            const x1 = from.x + (right ? CARD_WIDTH : 0)
            const x2 = to.x + (right ? 0 : CARD_WIDTH)
            const middle = (x1 + x2) / 2
            return <path key={edge.from + edge.to} d={`M ${x1} ${from.y} H ${middle} V ${to.y} H ${x2}`}><title>{edge.team} advances to its reseeded matchup</title></path>
          })}
        </svg>
        {nodes.map(node => <article key={node.id} role={node.game ? 'button' : undefined} tabIndex={node.game ? 0 : undefined} aria-label={node.game ? `View drives: ${node.game.away_team} at ${node.game.home_team}` : undefined} onClick={() => { if (node.game) onSelect(node.game) }} onKeyDown={e => { if (node.game && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(node.game) } }} className={`${styles.card} ${node.game?.game_type === 'SB' ? styles.final : ''}`} style={{ left: node.x, top: node.y - CARD_HEIGHT / 2, width: CARD_WIDTH, height: CARD_HEIGHT }}>
          {node.game ? <>
            <header>{node.game.game_type === 'SB' ? 'NEUTRAL SITE' : node.game.conference} · COMPLETE{node.game.overtime ? ' / OT' : ''}</header>
            {[['away', node.game.away_team, node.game.away_score, node.game.away_seed], ['home', node.game.home_team, node.game.home_score, node.game.home_seed]].map(([side, team, score, seed]) => <div key={side} className={winner(node.game!) === team ? styles.winner : ''}><span><small>#{seed}</small> {team}</span><strong>{score}</strong></div>)}
          </> : <><header>FIRST-ROUND BYE</header><div className={styles.winner}><span><small>#{node.bye?.seed}</small> {node.bye?.team}</span><strong>{node.x > BRACKET_WIDTH / 2 ? '←' : '→'}</strong></div><p>Advances to Divisional</p></>}
        </article>)}
      </div>
    </div>
  </section>
}
