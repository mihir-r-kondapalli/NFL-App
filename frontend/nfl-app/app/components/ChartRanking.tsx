'use client'

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, ReferenceLine } from 'recharts'
import { teamColors } from '../data/team_colors'
import { off } from 'process'

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

export default function ChartRankings({ year, offenseValues, defenseValues }: Props) {
  const data = teamOrder.map((team, i) => ({
    team,
    offense: offenseValues[i],
    defense: defenseValues[i],
    color: teamColors[team]?.primary || '#00ccff',
    labelColor: teamColors[team]?.secondary || '#ffffff',
  }))

  const renderCircle = (props: any) => {
    const { cx, cy, payload } = props
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={payload.color}
        stroke="#111"
      />
    )
  }
  

  // Determine bounds for chart
  const avgOffense = offenseValues.reduce((a, b) => a + b, 0) / offenseValues.length
  const avgDefense = defenseValues.reduce((a, b) => a + b, 0) / defenseValues.length
  const offenseOffsets = offenseValues.map(v => Math.abs(v - avgOffense))
  const defenseOffsets = defenseValues.map(v => Math.abs(v - avgDefense))
  const offenseRadius = Math.ceil(Math.max(...offenseOffsets) + 0.1)
  const defenseRadius = Math.ceil(Math.max(...defenseOffsets) + 0.1)
  const offenseDomain: [number, number] = [avgOffense - offenseRadius, avgOffense + offenseRadius]
  const defenseDomain: [number, number] = [avgDefense - defenseRadius, avgDefense + defenseRadius]

  return (
    <div style={{ width: '100%', height: 500 }}>
      <h2 style={{ fontSize: '24px', color: '#007000', marginBottom: '16px' }}>{year} Chart (Offense vs Defense)</h2>

      <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
        <CartesianGrid stroke="#444" strokeDasharray="3 3" />

        <XAxis
          type="number"
          dataKey="offense"
          name="Offense"
          domain={offenseDomain}
          stroke="#007000"
          tick={{ fill: '#007000', fontSize: 12 }}
          axisLine={{ stroke: '#007000' }}
          tickLine={{ stroke: '#007000' }}
          label={{ value: 'Offense', position: 'bottom', offset: 10, fill: '#007000' }}
          tickFormatter={(tick) => tick.toFixed(2)}
        />
        <YAxis
          type="number"
          dataKey="defense"
          name="Defense"
          domain={defenseDomain}
          stroke="#007000"
          tick={{ fill: '#007000', fontSize: 12 }}
          axisLine={{ stroke: '#007000' }}
          tickLine={{ stroke: '#007000' }}
          label={{ value: 'Defense', angle: -90, position: 'insideLeft', fill: '#007000' }}
          tickFormatter={(tick) => tick.toFixed(2)}
        />

        {/* Midpoint reference lines */}
        <ReferenceLine x={avgOffense} stroke="#888" strokeDasharray="3 3"/>
        <ReferenceLine y={avgDefense} stroke="#888" strokeDasharray="3 3"/>

        <Tooltip
          cursor={{ stroke: '#aaa', strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: '#002200',
            border: '1px solid #007000',
            color: 'white',
            fontFamily: 'monospace',
          }}
          labelStyle={{ color: 'white' }}
          itemStyle={{ color: 'white' }}
          formatter={(value: number, name: string) => [
            `${(value as number).toFixed(2)}`,
            name.charAt(0).toUpperCase() + name.slice(1),
          ]}
        />

        <Scatter name="Teams" data={data} shape={renderCircle}>
        <LabelList
          dataKey="team"
          position="top"
          content={({ x = 0, y = 0, value, index }) => {
            if (typeof index !== 'number') return null

            const labelColor = data[index]?.labelColor || '#ffffff'
            return (
              <text
                x={x}
                y={Number(y) - 10}
                fill={labelColor}
                fontSize={12}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {value}
              </text>
            )
          }}
        />
        </Scatter>
      </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
