'use client'

type Props = {
  offenseValues: number[]
  defenseValues: number[]
}

const teamOrder = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]

export default function Rankings({ offenseValues, defenseValues }: Props) {
  const offenseRanked = teamOrder.map((team, i) => ({ team, value: offenseValues[i] }))
  const defenseRanked = teamOrder.map((team, i) => ({ team, value: defenseValues[i] }))
  const totalRanked = teamOrder.map((team, i) => ({
    team,
    value: parseFloat((offenseValues[i] - defenseValues[i]).toFixed(2)),
  }))

  return (
    <div style={{ marginTop: '40px', width: '100%' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '16px', color: '#007000' }}>2024 Rankings</h2>

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
  
const teamColors: Record<string, { primary: string, secondary: string }> = {
    ARI: { primary: '#97233F', secondary: '#000000' },
    ATL: { primary: '#A71930', secondary: '#000000' },
    BAL: { primary: '#241773', secondary: '#9E7C0C' },
    BUF: { primary: '#00338D', secondary: '#C60C30' },
    CAR: { primary: '#0085CA', secondary: '#101820' },
    CHI: { primary: '#0B162A', secondary: '#C83803' },
    CIN: { primary: '#FB4F14', secondary: '#000000' },
    CLE: { primary: '#311D00', secondary: '#FF3C00' },
    DAL: { primary: '#041E42', secondary: '#869397' },
    DEN: { primary: '#FB4F14', secondary: '#002244' },
    DET: { primary: '#0076B6', secondary: '#B0B7BC' },
    GB:  { primary: '#203731', secondary: '#FFB612' },
    HOU: { primary: '#03202F', secondary: '#A71930' },
    IND: { primary: '#002C5F', secondary: '#A2AAAD' },
    JAX: { primary: '#006778', secondary: '#9F792C' },
    KC:  { primary: '#E31837', secondary: '#FFB81C' },
    LAC: { primary: '#0080C6', secondary: '#FFC20E' },
    LAR:  { primary: '#003594', secondary: '#FFD100' },
    LV:  { primary: '#000000', secondary: '#A5ACAF' },
    MIA: { primary: '#008E97', secondary: '#FC4C02' },
    MIN: { primary: '#4F2683', secondary: '#FFC62F' },
    NE:  { primary: '#002244', secondary: '#C60C30' },
    NO:  { primary: '#D3BC8D', secondary: '#101820' },
    NYG: { primary: '#0B2265', secondary: '#A71930' },
    NYJ: { primary: '#125740', secondary: '#FFFFFF' },
    PHI: { primary: '#004C54', secondary: '#A5ACAF' },
    PIT: { primary: '#FFB612', secondary: '#101820' },
    SEA: { primary: '#002244', secondary: '#69BE28' },
    SF:  { primary: '#AA0000', secondary: '#B3995D' },
    TB:  { primary: '#D50A0A', secondary: '#FF7900' },
    TEN: { primary: '#4B92DB', secondary: '#C8102E' },
    WAS: { primary: '#5A1414', secondary: '#FFB612' },
}
  