'use client'

import { useState } from 'react'
import TopBar from '../components/TopBar'
import ColumnRankings from '../components/ColumnRanking'
import ChartRankings from '../components/ChartRanking' // ✅ import the chart version

import {
  offenseValues2019, defenseValues2019,
  offenseValues2020, defenseValues2020,
  offenseValues2021, defenseValues2021,
  offenseValues2022, defenseValues2022,
  offenseValues2023, defenseValues2023,
  offenseValues2024, defenseValues2024
} from '../data/aep_values'

const yearOptions = [
  { label: '2019 Season', value: '2019' },
  { label: '2020 Season', value: '2020' },
  { label: '2021 Season', value: '2021' },
  { label: '2022 Season', value: '2022' },
  { label: '2023 Season', value: '2023' },
  { label: '2024 Season', value: '2024' },
]

const rankingMethods = [
  { label: 'List View', value: 'list' },
  { label: 'Chart View', value: 'chart' },
]

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

export default function RankingsPage() {
  const [selectedYear, setSelectedYear] = useState('2024')
  const [rankingMethod, setRankingMethod] = useState<'list' | 'chart'>('list')

  const offenseValues = offenseMap[selectedYear]
  const defenseValues = defenseMap[selectedYear]

  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
    }}>
      <TopBar />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        <h1 style={{ fontSize: '2rem', color: '#007000' }}>Team Rankings</h1>

        {/* Dropdown menus */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: '#006000' }}>
          <div>
            <label>Season:&nbsp;</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={dropdownStyle}
            >
              {yearOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label>View:&nbsp;</label>
            <select
              value={rankingMethod}
              onChange={(e) => setRankingMethod(e.target.value as 'list' | 'chart')}
              style={dropdownStyle}
            >
              {rankingMethods.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rankings Component */}
        {rankingMethod === 'list' ? (
          <ColumnRankings
            year={Number(selectedYear)}
            offenseValues={offenseValues}
            defenseValues={defenseValues}
          />
        ) : (
          <ChartRankings
            year={Number(selectedYear)}
            offenseValues={offenseValues}
            defenseValues={defenseValues}
          />
        )}
      </div>
    </div>
  )
}

const dropdownStyle = {
  padding: '6px 12px',
  backgroundColor: '#002200',
  color: 'white',
  border: '1px solid #555',
  borderRadius: '4px',
  fontFamily: 'monospace',
  fontSize: '14px',
}
