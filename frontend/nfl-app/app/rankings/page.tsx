'use client'

import { useState } from 'react'
import TopBar from '../components/TopBar'
import ColumnRankings from '../components/ColumnRanking'
import ChartRankings from '../components/ChartRanking' // ✅ import the chart version

import { useDataset, DatasetStatus } from '../components/DatasetProvider'

const rankingMethods = [
  { label: 'List View', value: 'list' },
  { label: 'Chart View', value: 'chart' },
]

export default function RankingsPage() {
  const [selectedYear, setSelectedYear] = useState('')
  const [rankingMethod, setRankingMethod] = useState<'list' | 'chart'>('list')

  const dataset = useDataset()
  const yearOptions = dataset.yearOptions.map(year => ({ label: `${year} Season`, value: String(year) }))
  const values = dataset.rankings[selectedYear] || {}
  const teamOrder = Object.keys(values)
  const offenseValues = teamOrder.map(team => values[team].offense)
  const defenseValues = teamOrder.map(team => values[team].defense)
  if (dataset.loading || dataset.error || !dataset.seasons.length) return <><TopBar /><DatasetStatus /></>

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
              <option value="" disabled>Select a season</option>
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
        {selectedYear && (rankingMethod === 'list' ? (
          <ColumnRankings
            teamOrder={teamOrder}
            year={Number(selectedYear)}
            offenseValues={offenseValues}
            defenseValues={defenseValues}
          />
        ) : (
          <ChartRankings
            teamOrder={teamOrder}
            year={Number(selectedYear)}
            offenseValues={offenseValues}
            defenseValues={defenseValues}
          />
        ))}
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
