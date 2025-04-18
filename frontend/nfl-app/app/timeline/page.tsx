'use client'

import { useState } from 'react'
import TopBar from '../components/TopBar'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Select from 'react-select'
import React from 'react'
import { teamColors } from '../data/team_colors'
import {
  offenseValues2019, defenseValues2019,
  offenseValues2020, defenseValues2020,
  offenseValues2021, defenseValues2021,
  offenseValues2022, defenseValues2022,
  offenseValues2023, defenseValues2023,
  offenseValues2024, defenseValues2024
} from '../data/aep_values'

const teamOrder = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAR', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]

const years = ['2019', '2020', '2021', '2022', '2023', '2024']

const offenseMap: Record<string, number[]> = {
  '2019': offenseValues2019,
  '2020': offenseValues2020,
  '2021': offenseValues2021,
  '2022': offenseValues2022,
  '2023': offenseValues2023,
  '2024': offenseValues2024,
}

const defenseMap: Record<string, number[]> = {
  '2019': defenseValues2019,
  '2020': defenseValues2020,
  '2021': defenseValues2021,
  '2022': defenseValues2022,
  '2023': defenseValues2023,
  '2024': defenseValues2024,
}

const metricOptions = [
    { label: 'Offense', value: 'offense' },
    { label: 'Defense', value: 'defense' },
    { label: 'Total', value: 'total' },
]

const viewOptions = [
    { label: 'Value', value: 'value' },
    { label: 'Rank', value: 'rank' },
]


const allTeamOptions = teamOrder.map(team => ({
  label: team,
  value: team,
}))

export default function TimelinePage() {
  const [selectedTeams, setSelectedTeams] = useState<{ label: string; value: string }[]>([
    { label: 'DET', value: 'DET' },
    { label: 'BUF', value: 'BUF' },
  ])
  const [statType, setStatType] = useState<'offense' | 'defense' | 'total'>('total')
  const [viewType, setViewType] = useState<'value' | 'rank'>('value')

  const chartData = years.map(year => {
    const entry: any = { year }
  
    const values = teamOrder.map((team, i) => {
      const off = offenseMap[year][i]
      const def = defenseMap[year][i]
      const total = parseFloat((off - def).toFixed(2))
  
      return {
        team,
        value: statType === 'offense' ? off : statType === 'defense' ? def : total
      }
    })
  
    const ranked = [...values].sort((a, b) =>
        statType === 'defense' ? a.value - b.value : b.value - a.value
    )      
    const rankMap = new Map(ranked.map((v, i) => [v.team, i + 1]))
  
    selectedTeams.forEach(({ value: team }) => {
      const idx = teamOrder.indexOf(team)
      const val = values.find(v => v.team === team)?.value ?? 0
      entry[team] = viewType === 'value' ? val : rankMap.get(team)
    })
  
    return entry
  })

  return (
    <div style={{ fontFamily: 'monospace', color: 'white', minHeight: '100vh' }}>
      <TopBar />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '2rem', color: '#009900', marginBottom: '10px' }}>Team Timelines</h1>

        {/* Team Selector */}
        <div style={{ marginBottom: '20px' }}>
          <Select
            isMulti
            options={allTeamOptions}
            value={selectedTeams}
            onChange={(options) => setSelectedTeams(options as any)}
            formatOptionLabel={(e) => (
              <span style={{
                backgroundColor: teamColors[e.value]?.primary,
                color: teamColors[e.value]?.secondary,
                padding: '4px 8px',
                borderRadius: '4px',
                display: 'inline-block'
              }}>{e.label}</span>
            )}
            styles={{
              control: (base) => ({
                ...base,
                backgroundColor: '#002200',
                borderColor: '#555',
                color: 'white',
              }),
              menu: (base) => ({
                ...base,
                backgroundColor: '#002200',
                color: 'white',
              }),
              multiValueLabel: (styles, { data }) => ({
                ...styles,
                backgroundColor: teamColors[data.value]?.primary || '#444',
                color: teamColors[data.value]?.secondary || '#fff',
              }),
              multiValueRemove: (styles) => ({
                ...styles,
                color: '#ccc',
                ':hover': { backgroundColor: '#500', color: 'white' }
              })
            }}
          />
        </div>

        <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            flexWrap: 'wrap', // optional, lets it wrap on small screens
        }}>

            {/* Metric Dropdown */}
            <div style={{ marginBottom: '24px', width: '240px' }}>
            <Select
                options={metricOptions}
                value={metricOptions.find(opt => opt.value === statType)}
                onChange={(opt) => setStatType(opt?.value as 'offense' | 'defense' | 'total')}
                styles={{
                control: (base) => ({
                    ...base,
                    backgroundColor: '#002200',
                    borderColor: '#555',
                    color: 'white',
                }),
                menu: (base) => ({
                    ...base,
                    backgroundColor: '#002200',
                    color: 'white',
                }),
                singleValue: (styles) => ({
                    ...styles,
                    color: 'white',
                }),
                }}
            />
            </div>

            {/* View Type Dropdown */}
            <div style={{ marginBottom: '24px', width: '240px' }}>
            <Select
                options={viewOptions}
                value={viewOptions.find(opt => opt.value === viewType)}
                onChange={(opt) => setViewType(opt?.value as 'value' | 'rank')}
                styles={{
                control: (base) => ({
                    ...base,
                    backgroundColor: '#002200',
                    borderColor: '#555',
                    color: 'white',
                }),
                menu: (base) => ({
                    ...base,
                    backgroundColor: '#002200',
                    color: 'white',
                }),
                singleValue: (styles) => ({
                    ...styles,
                    color: 'white',
                }),
                }}
            />
            </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="year"
              stroke="#00ff99"
              tick={{ fill: '#00aa99', fontSize: 12 }}
              axisLine={{ stroke: '#007000' }}
              tickLine={{ stroke: '#007000' }}
            />
            <YAxis
                stroke="#00ff99"
                tick={{ fill: '#00aa99', fontSize: 12 }}
                axisLine={{ stroke: '#007000' }}
                tickLine={{ stroke: '#007000' }}
                reversed={viewType === 'rank'}
            />
            <Tooltip />
            <Legend />

            {selectedTeams.map(({ value: team }) => {
              const color = teamColors[team]?.primary || '#00ccff'
              return (
                <Line
                  key={`${team}_${statType}`}
                  type="monotone"
                  dataKey={team}
                  name={`${team} ${statType.charAt(0).toUpperCase() + statType.slice(1)}`}
                  stroke={color}
                  strokeDasharray={statType === 'defense' ? '4 2' : statType === 'total' ? '2 2' : undefined}
                  dot={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
