'use client'

import { teamColors } from "../data/team_colors"

type Props = {
  year: number
  offenseValues: number[]
  defenseValues: number[]
}

const teamOrder = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAR', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]

export default function Rankings({ year, offenseValues, defenseValues }: Props) {
  const offenseRanked = teamOrder.map((team, i) => ({ team, value: offenseValues[i] }))
  const defenseRanked = teamOrder.map((team, i) => ({ team, value: defenseValues[i] }))
  const totalRanked = teamOrder.map((team, i) => ({
    team,
    value: parseFloat((offenseValues[i] - defenseValues[i]).toFixed(2)),
  }))

  return (
    <div style={{ marginTop: '40px', width: '100%' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#007000' }}>{year} Rankings</h2>

      <div style={columnLayout}>
        <RankingColumn title="Total Ranking" values={totalRanked} />
        <RankingColumn title="Offense Ranking" values={offenseRanked} />
        <RankingColumn title="Defense Ranking" values={defenseRanked} ascending />
        </div>
    </div>
  )
}

function RankingColumn({
    title,
    values,
    ascending = false,
}: {
    title: string
    values: { team: string; value: number }[]
    ascending?: boolean
}) {
const sorted = values.slice().sort((a, b) =>
    ascending ? a.value - b.value : b.value - a.value
)

return (
    <div style={columnBox}>
    <h3 style={sectionTitle}>{title}</h3>
    <div style={tableStyle}>
        {sorted.map((entry, i) => {
        const team = entry.team
        const colors = teamColors[team] || {
            primary: '#003300',
            secondary: '#ffffff',
        }

        return (
            <div
            key={i}
            style={{
                ...rowStyle,
                backgroundColor: colors.primary,
                color: colors.secondary,
            }}
            >
            <span style={{ ...rankStyle, color: colors.secondary }}>
                {i + 1}.
            </span>{' '}
            {team}: {entry.value.toFixed(2)}
            </div>
        )
        })}
    </div>
    </div>
)
}  

const columnLayout = {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '24px',
    justifyContent: 'space-between' as const,
    flexWrap: 'wrap' as const,
}

const columnBox = {
    flex: '1 1 300px',
    minWidth: '280px',
    backgroundColor: '#002000',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '16px',
}

const sectionTitle = {
    fontSize: '20px',
    marginBottom: '8px',
    borderBottom: '1px solid #444',
    paddingBottom: '4px',
}

const tableStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    fontFamily: 'monospace',
    fontSize: '15px',
}

const rowStyle = {
    padding: '6px 10px',
    backgroundColor: '#003300',
    borderRadius: '4px',
    border: '1px solid #222',
}

const rankStyle = {
    fontWeight: 'bold',
    display: 'inline-block',
    width: '2.5em',
    color: '#00ff99',
}