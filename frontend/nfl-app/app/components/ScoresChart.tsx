'use client'

import React from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from 'recharts'
import { teamColors } from '../data/team_colors'
import { isDarkColor } from './ColorHelp'

type ScoresChartProps = {
  team1: string
  team2: string
  team1Scores: number[]
  team2Scores: number[]
}

export default function ScoresChart({ team1, team2, team1Scores, team2Scores }: ScoresChartProps) {
  // Create the data points for the scatter plot
  // team2Scores on x-axis, team1Scores on y-axis
  const data = team1Scores.map((score1, index) => ({
    x: team2Scores[index], // team2 on x-axis
    y: score1,             // team1 on y-axis
    game: index + 1
  }))

  // Find the range for the axes
  const maxScore = Math.max(
    ...team1Scores, 
    ...team2Scores,
    30 // Minimum max value to ensure decent scale
  ) + 5 // Add padding

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const game = payload[0].payload.game
      const team2Score = payload[0].payload.x  // This is team2's score (x-axis)
      const team1Score = payload[0].payload.y  // This is team1's score (y-axis)
      const winner = team1Score > team2Score ? team1 : team1Score < team2Score ? team2 : 'Tie'
      
      return (
        <div style={{
          backgroundColor: '#001500',
          border: '1px solid #004400',
          padding: '10px',
          borderRadius: '4px',
          color: 'white',
          fontFamily: 'monospace'
        }}>
          <p style={{ margin: '0 0 5px 0' }}>Game {game}</p>
          <p style={{ 
            margin: '0',
            color: !isDarkColor(teamColors[team1]?.secondary) ? teamColors[team1]?.secondary : 'white'
          }}>{team1}: {team1Score}</p>
          <p style={{ 
            margin: '0 0 5px 0',
            color: !isDarkColor(teamColors[team2]?.secondary) ? teamColors[team2]?.secondary : 'white'
          }}>{team2}: {team2Score}</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px' }}>Winner: {winner}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ width: '100%', height: 400, marginTop: '20px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 20, right: 20, bottom: 40, left: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            type="number" 
            dataKey="x" 
            name={team2} 
            domain={[0, maxScore]} 
            label={{ 
              value: team2,  // team2 label for x-axis
              position: 'bottom', 
              offset: 10,
              fill: !isDarkColor(teamColors[team2]?.secondary) ? teamColors[team2]?.secondary : 'white' 
            }}
            tick={{ fill: '#aaa' }}
            stroke="#444"
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name={team1} 
            domain={[0, maxScore]} 
            label={{ 
              value: team1,  // team1 label for y-axis
              angle: -90, 
              position: 'left',
              offset: 0,
              fill: !isDarkColor(teamColors[team1]?.secondary) ? teamColors[team1]?.secondary : 'white' 
            }}
            tick={{ fill: '#aaa' }}
            stroke="#444"
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Diagonal line representing equal scores (ties) */}
          <ReferenceLine 
            segment={[{ x: 0, y: 0 }, { x: maxScore, y: maxScore }]} 
            stroke="#aaa" 
            strokeDasharray="3 3" 
            label={{ 
              value: 'Tie Line', 
              position: 'right', 
              offset: 5,
              fill: '#777'
            }} 
          />
          
          <Scatter 
            name="Game Scores" 
            data={data} 
            fill={ '#00aa00'} 
            shape="circle"
            line={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        fontSize: '14px',
        color: '#aaa'
      }}>
        <span>
          Points above the line: {team1} wins | 
          Points below the line: {team2} wins | 
          Points on the line: Ties
        </span>
      </div>
    </div>
  )
}