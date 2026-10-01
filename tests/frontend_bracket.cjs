// Offline bracket fixtures: no NFL data or simulated games.
const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('../frontend/nfl-app/node_modules/typescript')
const Module = require('node:module')
const filename = path.resolve(__dirname, '../frontend/nfl-app/app/season/bracket-layout.ts')
const compiled = new Module(filename, module)
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
const { bracketLayout, winner, CARD_WIDTH, BRACKET_WIDTH } = compiled.exports

function fixture(count) {
  const games = [], seeds = {}
  function game(conf, round, home, away) {
    const row = { game_id: `${conf}-${round}-${home}-${away}`, conference: conf, game_type: round,
      home_team: `${conf}${home}`, away_team: `${conf}${away}`, home_seed: home, away_seed: away,
      home_score: 10, away_score: 24, overtime: false }
    games.push(row)
  }
  for (const conf of ['AFC', 'NFC']) {
    seeds[conf] = Array.from({ length: count }, (_, i) => ({ team: `${conf}${i+1}`, seed: i+1 }))
    if (count === 7) {
      game(conf, 'WC', 2, 7); game(conf, 'WC', 3, 6); game(conf, 'WC', 4, 5)
      game(conf, 'DIV', 1, 7); game(conf, 'DIV', 5, 6); game(conf, 'CON', 6, 7)
    } else {
      game(conf, 'WC', 3, 6); game(conf, 'WC', 4, 5)
      game(conf, 'DIV', 1, 6); game(conf, 'DIV', 2, 5); game(conf, 'CON', 5, 6)
    }
  }
  games.push({ game_id: 'SB', game_type: 'SB', conference: 'NFL', home_team: `AFC${count}`, away_team: `NFC${count}`, home_score: 17, away_score: 20, overtime: true })
  return { games, seeds }
}
for (const count of [6, 7]) {
  test(`${count}-team conferences: actual upset paths and byes reach the Super Bowl`, () => {
    const { games, seeds } = fixture(count)
    const { nodes, edges } = bracketLayout(games, seeds)
    assert.equal(nodes.length, 15)
    assert.equal(new Set(nodes.map(n => n.id)).size, nodes.length)
    assert.equal(nodes.filter(n => n.game).length, games.length)
    assert.equal(nodes.filter(n => n.bye).length, count === 7 ? 2 : 4)
    assert.equal(edges.length, 14)
    assert.equal(edges.filter(e => e.to === 'SB').length, 2)
    for (const edge of edges) {
      const source = nodes.find(n => n.id === edge.from)
      const destination = nodes.find(n => n.id === edge.to)
      assert.equal(edge.team, source.game ? winner(source.game) : source.bye.team)
      assert.ok([destination.game.home_team, destination.game.away_team].includes(edge.team))
      assert.ok(source.x >= 0 && source.x + CARD_WIDTH <= BRACKET_WIDTH)
    }
  })
}

test('Wild-Card positions stay in seed order while reseeded advancement lines change', () => {
  const { games, seeds } = fixture(7)
  const { nodes, edges } = bracketLayout([...games].reverse(), seeds)
  const opening = nodes.filter(n => n.x === 0).sort((a, b) => a.y - b.y)
  assert.deepEqual(opening.map(n => n.bye?.seed ?? n.game.home_seed), [1, 2, 3, 4])
  const seventhSeed = opening.find(n => n.game?.away_seed === 7)
  const destination = nodes.find(n => n.id === edges.find(e => e.from === seventhSeed.id).to)
  assert.equal(destination.game.home_seed, 1)
  assert.equal(destination.game.away_seed, 7)
  const fifthSeed = opening.find(n => n.game?.away_seed === 5)
  const next = nodes.find(n => n.id === edges.find(e => e.from === fifthSeed.id).to)
  assert.equal(next.game.home_seed, 5)
  assert.equal(next.game.away_seed, 6)
})
