export type Drive = { end_yards_to_goal?: number; kick_end_yards_to_goal?: number; result?: string; number: number; team: string; start: string; end: string; start_yards_to_goal: number; plays: number; home_score: number; away_score: number; outcome: string; events: { clock: string; message: string; home_score: number; away_score: number }[] }
export type BracketGame = {
  drives?: Drive[] | null;
  game_id: string; home_team: string; away_team: string; home_score: number; away_score: number;
  home_seed?: number; away_seed?: number; game_type: string; conference?: string; overtime: boolean;
}
export type BracketSeed = { team: string; seed: number }
export type BracketNode = { id: string; x: number; y: number; game?: BracketGame; bye?: BracketSeed }
export type BracketEdge = { from: string; to: string; team: string }
export const CARD_WIDTH = 220
export const CARD_HEIGHT = 118
export const BRACKET_WIDTH = 1840
export const BRACKET_HEIGHT = 740
export const winner = (g: BracketGame) => g.home_score > g.away_score ? g.home_team : g.away_team

/** Lay out the actual advancement paths, including reseeding and first-round byes. */
export function bracketLayout(games: BracketGame[], seeds: Record<string, BracketSeed[]>) {
  const nodes: BracketNode[] = []
  const edges: BracketEdge[] = []
  const final = games.find(g => g.game_type === 'SB')
  if (final) nodes.push({ id: final.game_id, x: 810, y: 380, game: final })
  for (const [conference, direction] of [['AFC', 1], ['NFC', -1]] as const) {
    const x = (round: number) => direction === 1 ? round * 270 : 1620 - round * 270
    const conferenceGames = games.filter(g => g.conference === conference)
    const wildcards = conferenceGames.filter(g => g.game_type === 'WC')
    const divisional = conferenceGames.filter(g => g.game_type === 'DIV')
      .sort((a, b) => (a.home_seed || 0) - (b.home_seed || 0))
    const championship = conferenceGames.find(g => g.game_type === 'CON')
    // Keep the opening round in seed order, independent of later results.
    // Connections can cross when upsets cause the next round to reseed.
    const opening: BracketNode[] = wildcards.map(game => ({ id: game.game_id, x: x(0), y: 0, game }))
    const appeared = new Set(wildcards.flatMap(g => [g.home_team, g.away_team]))
    for (const seed of seeds[conference] || []) {
      if (!appeared.has(seed.team)) opening.push({ id: `${conference}-bye-${seed.team}`, x: x(0), y: 0, bye: seed })
    }
    opening.sort((a, b) => (a.bye?.seed ?? a.game?.home_seed ?? 0) - (b.bye?.seed ?? b.game?.home_seed ?? 0))
    opening.forEach((node, i) => { node.y = 140 + i * 160; nodes.push(node) })
    divisional.forEach((game, i) => {
      const y = 220 + i * 320
      nodes.push({ id: game.game_id, x: x(1), y, game })
      for (const team of [game.home_team, game.away_team]) {
        const source = opening.find(n => n.bye?.team === team || (n.game && winner(n.game) === team))
        if (source) edges.push({ from: source.id, to: game.game_id, team })
      }
      if (championship) edges.push({ from: game.game_id, to: championship.game_id, team: winner(game) })
    })
    if (championship) {
      nodes.push({ id: championship.game_id, x: x(2), y: 380, game: championship })
      if (final) edges.push({ from: championship.game_id, to: final.game_id, team: winner(championship) })
    }
  }
  return { nodes, edges }
}
