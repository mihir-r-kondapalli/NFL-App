'use client'

import { useState } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Select from 'react-select'
import React from 'react'
import { teamColors } from '../data/team_colors'
import { teamNames } from '../data/team_names'
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
  label: teamNames[team] || team,
  value: team,
}))

// Define theme for better color visibility - similar to EPSPage
const theme = {
  colors: {
    background: {
      main: '#ffffff',
      dark: '#f0f0f0',
      darker: '#e0e0e0'
    },
    text: {
      primary: '#333333',
      secondary: '#555555',
      light: '#777777',
      highlight: '#007700'
    },
    accent: {
      primary: '#006600',
      secondary: '#00aa00',
      light: '#00cc00',
      highlight: '#00ee00'
    },
    chart: {
      grid: '#dddddd',
      axis: '#222222'
    },
    button: {
      primary: '#008800',
      hover: '#00aa00',
      text: '#ffffff'
    },
    error: '#cc3333'
  }
}

// Helper function to adjust color brightness
const adjustColor = (color: string, percent: number): string => {
  // Remove the # if present
  let hex = color.replace('#', '');
  
  // Convert 3-digit hex to 6-digit
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Parse the hex values
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  // Adjust by percentage
  r = Math.floor(r * (100 + percent) / 100);
  g = Math.floor(g * (100 + percent) / 100);
  b = Math.floor(b * (100 + percent) / 100);
  
  // Ensure values are within 0-255
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  
  // Convert back to hex
  const newHex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  
  return `#${newHex}`;
};

// Card Component for consistent styling
const Card: React.FC<{
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}> = ({ children, title, subtitle }) => (
  <div style={{
    backgroundColor: theme.colors.background.main,
    borderRadius: '8px',
    padding: '25px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    border: '1px solid #003300',
    marginBottom: '30px'
  }}>
    {title && (
      <h2 style={{ 
        fontSize: '1.5rem', 
        color: theme.colors.text.primary, 
        marginBottom: subtitle ? '5px' : '20px',
        fontWeight: 'bold'
      }}>
        {title}
      </h2>
    )}
    {subtitle && (
      <p style={{ 
        color: theme.colors.text.secondary, 
        marginBottom: '20px', 
        fontSize: '16px',
        fontWeight: '500'
      }}>
        {subtitle}
      </p>
    )}
    {children}
  </div>
);

// Form Group Component
const FormGroup: React.FC<{
  label?: string;
  children: React.ReactNode;
  helperText?: string;
}> = ({ label, children, helperText }) => (
  <div style={{ marginBottom: '20px' }}>
    {label && (
      <label style={{ 
        display: 'block', 
        marginBottom: '6px', 
        fontSize: '14px', 
        fontWeight: '500',
        color: theme.colors.text.secondary
      }}>
        {label}
      </label>
    )}
    {children}
    {helperText && (
      <div style={{ 
        marginTop: '5px', 
        fontSize: '14px', 
        color: theme.colors.text.secondary, 
        fontStyle: 'italic'
      }}>
        {helperText}
      </div>
    )}
  </div>
);

// Custom tooltip component
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  viewType: string;
}> = ({ active, payload, label, viewType }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${theme.colors.accent.primary}`,
        padding: '10px',
        borderRadius: '4px',
        color: theme.colors.text.primary,
        fontFamily: 'monospace',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Year: {label}</p>
        {payload.map((entry, index) => {
          const team = entry.name.split(' ')[0];
          return (
            <p key={index} style={{ 
              margin: index === payload.length - 1 ? '0' : '0 0 5px 0',
              color: entry.color,
              fontWeight: '500'
            }}>
              {entry.name}: {viewType === 'rank' ? `#${entry.value}` : entry.value.toFixed(2)}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function TimelinePage() {
  const [selectedTeams, setSelectedTeams] = useState<Array<{ label: string, value: string }>>([
    { label: teamNames['DET'] || 'DET', value: 'DET' },
    { label: teamNames['BUF'] || 'BUF', value: 'BUF' },
  ])
  const [statType, setStatType] = useState<'offense' | 'defense' | 'total'>('total')
  const [viewType, setViewType] = useState<'value' | 'rank'>('value')

  const chartData = years.map(year => {
    const entry: Record<string, any> = { year }
  
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

  // Find min and max values for better Y-axis range
  const allChartValues = chartData.flatMap(point => 
    Object.entries(point)
      .filter(([key]) => key !== 'year')
      .map(([_, value]) => value as number)
  );
  
  const minVal = allChartValues.length > 0 && viewType === 'value' ? Math.min(...allChartValues) : 0;
  const maxVal = allChartValues.length > 0 ? 
    (viewType === 'value' ? Math.max(...allChartValues) : 32) : 
    (viewType === 'value' ? 10 : 32);
  
  // Round to nearest integer and add padding for value view
  const yAxisMin = viewType === 'value' ? Math.floor(minVal) - 1 : 1;
  const yAxisMax = viewType === 'value' ? Math.ceil(maxVal) + 1 : 32;

  return (
    <div style={{ 
      fontFamily: 'monospace', 
      color: theme.colors.text.primary, 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.background.darker
    }}>
      <TopBar />

      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          marginBottom: '20px', 
          color: theme.colors.accent.primary,
          fontWeight: 'bold'
        }}>
          Team Performance Timelines
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: theme.colors.text.secondary, 
          marginBottom: '30px' 
        }}>
          Track and compare NFL team performances over multiple seasons (2019-2024).
        </p>

        {/* Settings Card */}
        <Card title="Customize Timeline">
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '30px',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}>
            {/* Team selection */}
            <div style={{ flex: '1 1 300px' }}>
              <FormGroup 
                label="Select Teams to Compare:" 
                helperText={`${selectedTeams.length} team${selectedTeams.length === 1 ? '' : 's'} selected`}
              >
                <Select
                  isMulti
                  options={allTeamOptions}
                  value={selectedTeams}
                  onChange={(options) => setSelectedTeams(options as Array<{ label: string, value: string }>)}
                  formatOptionLabel={(e) => (
                    <span style={{
                      backgroundColor: teamColors[e.value]?.primary,
                      color: teamColors[e.value]?.secondary || '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      fontWeight: '500'
                    }}>{e.label}</span>
                  )}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      borderColor: theme.colors.accent.primary,
                      color: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      padding: '3px',
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      border: `1px solid ${theme.colors.accent.primary}`,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused 
                        ? `${theme.colors.accent.primary}22` 
                        : base.backgroundColor,
                      color: theme.colors.text.primary,
                      padding: '8px 12px',
                    }),
                    multiValueLabel: (styles, { data }) => ({
                      ...styles,
                      backgroundColor: teamColors[data.value]?.primary || '#444',
                      color: teamColors[data.value]?.secondary || '#fff',
                    }),
                    multiValueRemove: (styles, { data }) => ({
                      ...styles,
                      color: teamColors[data.value]?.secondary || '#fff',
                      backgroundColor: teamColors[data.value]?.primary || '#444',
                      ':hover': { 
                        backgroundColor: adjustColor(teamColors[data.value]?.primary || '#444', -20),
                        color: teamColors[data.value]?.secondary || '#fff'
                      }
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: theme.colors.text.light,
                    }),
                  }}
                  placeholder="Select teams to compare..."
                />
              </FormGroup>
            </div>

            <div style={{ flex: '1 1 300px' }}>
              <FormGroup 
                label="Metric:"
                helperText={
                  statType === 'offense' 
                    ? 'Shows offensive performance metrics' 
                    : statType === 'defense'
                      ? 'Shows defensive performance metrics'
                      : 'Shows combined team performance (offense - defense)'
                }
              >
                <Select
                  options={metricOptions}
                  value={metricOptions.find(opt => opt.value === statType)}
                  onChange={(opt) => {
                    if (opt?.value === 'offense' || opt?.value === 'defense' || opt?.value === 'total') {
                      setStatType(opt.value);
                    }
                  }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      borderColor: theme.colors.accent.primary,
                      color: theme.colors.text.primary,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      padding: '3px',
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      border: `1px solid ${theme.colors.accent.primary}`,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused 
                        ? `${theme.colors.accent.primary}22` 
                        : base.backgroundColor,
                      color: theme.colors.text.primary,
                      padding: '8px 12px',
                    }),
                    singleValue: (styles) => ({
                      ...styles,
                      color: theme.colors.text.primary,
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: theme.colors.text.light,
                    }),
                  }}
                />
              </FormGroup>

              <FormGroup 
                label="Display:"
                helperText={
                  viewType === 'value' 
                    ? 'Shows actual performance values' 
                    : 'Shows team ranking (lower is better)'
                }
              >
                <Select
                  options={viewOptions}
                  value={viewOptions.find(opt => opt.value === viewType)}
                  onChange={(opt) => {
                    if (opt?.value === 'value' || opt?.value === 'rank') {
                      setViewType(opt.value);
                    }
                  }}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      borderColor: theme.colors.accent.primary,
                      color: theme.colors.text.primary,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      padding: '3px',
                    }),
                    menu: (base) => ({
                      ...base,
                      backgroundColor: '#ffffff',
                      border: `1px solid ${theme.colors.accent.primary}`,
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    }),
                    option: (base, state) => ({
                      ...base,
                      backgroundColor: state.isFocused 
                        ? `${theme.colors.accent.primary}22` 
                        : base.backgroundColor,
                      color: theme.colors.text.primary,
                      padding: '8px 12px',
                    }),
                    singleValue: (styles) => ({
                      ...styles,
                      color: theme.colors.text.primary,
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: theme.colors.text.light,
                    }),
                  }}
                />
              </FormGroup>
            </div>
          </div>
        </Card>

        {/* Chart Section */}
        <Card 
          title={`${statType.charAt(0).toUpperCase() + statType.slice(1)} Timeline`} 
          subtitle={`Tracking ${viewType === 'value' ? 'performance values' : 'rankings'} from 2019 to 2024`}
        >
          {selectedTeams.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: '400px',
              backgroundColor: theme.colors.background.dark,
              borderRadius: '4px',
              border: `1px solid ${theme.colors.accent.primary}`,
            }}>
              <p style={{ 
                color: theme.colors.text.secondary,
                fontWeight: '500',
                fontSize: '18px'
              }}>
                Please select at least one team to display data
              </p>
            </div>
          ) : (
            <div style={{ height: '500px', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chart.grid} />
                  <XAxis
                    dataKey="year"
                    stroke={theme.colors.chart.axis}
                    tick={{ fill: theme.colors.text.primary }}
                    axisLine={{ stroke: theme.colors.chart.axis }}
                    tickLine={{ stroke: theme.colors.chart.axis }}
                    padding={{ left: 20, right: 20 }}
                    label={{ 
                      value: 'Year', 
                      position: 'bottom', 
                      offset: 0,
                      fill: theme.colors.text.primary
                    }}
                  />
                  <YAxis
                    stroke={theme.colors.chart.axis}
                    tick={{ fill: theme.colors.text.primary }}
                    axisLine={{ stroke: theme.colors.chart.axis }}
                    tickLine={{ stroke: theme.colors.chart.axis }}
                    reversed={viewType === 'rank'}
                    domain={[yAxisMin, yAxisMax]}
                    allowDecimals={viewType === 'value'}
                    label={{
                      value: viewType === 'value' ? 'Value' : 'Rank',
                      angle: -90,
                      position: 'insideLeft',
                      fill: theme.colors.text.primary
                    }}
                  />
                  <Tooltip content={<CustomTooltip viewType={viewType} />} />
                  <Legend 
                    verticalAlign="top" 
                    wrapperStyle={{ paddingBottom: '10px' }}
                  />

                  {selectedTeams.map(({ value: team }) => {
                    const color = teamColors[team]?.primary || '#00ccff'
                    return (
                      <Line
                        key={`${team}_${statType}`}
                        type="monotone"
                        dataKey={team}
                        name={`${teamNames[team] || team} ${statType.charAt(0).toUpperCase() + statType.slice(1)}`}
                        stroke={color}
                        strokeWidth={3}
                        strokeDasharray={statType === 'defense' ? '4 2' : undefined}
                        dot={{
                          r: 5,
                          fill: color,
                          stroke: '#ffffff',
                          strokeWidth: 1,
                        }}
                        activeDot={{ r: 7, stroke: '#ffffff', strokeWidth: 2 }}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ 
            marginTop: '15px', 
            display: 'flex', 
            justifyContent: 'center',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            <div style={{ marginRight: '20px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '20px', 
                height: '3px', 
                backgroundColor: theme.colors.accent.primary,
                marginRight: '5px',
              }}></span>
              Standard Line (Offense/Total)
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '20px', 
                height: '3px', 
                backgroundImage: 'linear-gradient(to right, #00aa00 4px, transparent 4px, transparent 8px)',
                backgroundSize: '8px 3px',
                marginRight: '5px',
              }}></span>
              Dashed Line (Defense)
            </div>
          </div>
        </Card>

        {/* Description Section */}
        <Card title="About Team Performance Metrics">
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            This timeline tracks NFL team performance metrics from 2019 to 2024, allowing you to visualize trends and compare teams over multiple seasons.
          </p>
          
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: theme.colors.background.dark, 
            borderRadius: '4px', 
            border: `1px solid ${theme.colors.accent.primary}` 
          }}>
            <h3 style={{ 
              color: theme.colors.text.primary, 
              marginBottom: '10px', 
              fontSize: '16px', 
              fontWeight: 'bold' 
            }}>
              Understanding the Metrics
            </h3>
            <ul style={{ 
              color: theme.colors.text.secondary, 
              paddingLeft: '20px', 
              lineHeight: '1.5' 
            }}>
              <li style={{ marginBottom: '8px' }}>
                <strong>Offense:</strong> Higher values indicate better offensive performance.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Defense:</strong> Lower values indicate better defensive performance.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Total:</strong> Combined team performance (offense minus defense). Higher values indicate better overall performance.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Value View:</strong> Shows actual performance metrics.
              </li>
              <li style={{ marginBottom: '8px' }}>
                <strong>Rank View:</strong> Shows team rankings (1 is best, 32 is worst).
              </li>
            </ul>
            <p style={{ 
              marginTop: '15px', 
              color: theme.colors.text.secondary 
            }}>
              The <strong>4th & Sim</strong> model calculates these metrics based on actual play distributions and dynamic gameplay algorithms, offering more accurate team-specific insights than traditional NFL metrics.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}