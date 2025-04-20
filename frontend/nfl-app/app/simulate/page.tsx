'use client'

import { useState } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import ScoresChart from '../components/ScoresChart'
import { teamColors } from '../data/team_colors'
import { teamNames } from '../data/team_names'
import { isDarkColor } from '../components/ColorHelp'

export default function SimulatePage() {
  const [team1, setTeam1] = useState('SF')
  const [team2, setTeam2] = useState('KC')
  const [year1, setYear1] = useState(2019)
  const [year2, setYear2] = useState(2019)
  const [numGames, setNumGames] = useState(1)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')

  const teamOptions = [
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB',
    'HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG',
    'NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ]

  const yearOptions = [2019, 2020, 2021, 2022, 2023, 2024]

  const runSimulation = async () => {
    setLoading(true)
    setError('')
    setResults(null)

    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          team1,
          team2,
          year1,
          year2,
          num_games: numGames,
          num_plays: 130 // Using a default value of 130
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'API server could not be reached' }))
        throw new Error(errorData.detail || 'Failed to run simulation')
      }

      const responseText = await response.text()
      let data
      
      try {
        data = JSON.parse(responseText)
      } catch (err) {
        console.error('Failed to parse JSON response:', responseText)
        throw new Error('Backend server is not online or returned an invalid response')
      }
      
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Backend server is not online right now or user inputted invalid number of games.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      fontFamily: 'monospace',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <TopBar />

      <div style={{
        flex: 1,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '20px', color: '#007000' }}>
          Simulate Games
        </h1>
        <p style={{ fontSize: '16px', color: '#888', marginBottom: '30px' }}>
          Run simulations between any two NFL teams from 2019 to 2024 using the advanced game engine.
        </p>

        <div style={cardStyle}>
          <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>Simulation Setup</h2>
          
          <div style={formContainerStyle}>
            <div style={formColumnStyle}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Team 1:</label>
                <select 
                  value={team1} 
                  onChange={(e) => setTeam1(e.target.value)}
                  style={{
                    ...selectStyle,
                    backgroundColor: teamColors[team1]?.primary || '#ffffff',
                    color: teamColors[team1]?.secondary || '#000000'
                  }}
                >
                  {teamOptions.map(team => (
                    <option key={`team1-${team}`} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Year 1:</label>
                <select 
                  value={year1} 
                  onChange={(e) => setYear1(Number(e.target.value))}
                  style={selectStyle}
                >
                  {yearOptions.map(year => (
                    <option key={`year1-${year}`} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={formColumnStyle}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Team 2:</label>
                <select 
                  value={team2} 
                  onChange={(e) => setTeam2(e.target.value)}
                  style={{
                    ...selectStyle,
                    backgroundColor: teamColors[team2]?.primary || '#ffffff',
                    color: teamColors[team2]?.secondary || '#000000'
                  }}
                >
                  {teamOptions.map(team => (
                    <option key={`team2-${team}`} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              <div style={formGroupStyle}>
                <label style={labelStyle}>Year 2:</label>
                <select 
                  value={year2} 
                  onChange={(e) => setYear2(Number(e.target.value))}
                  style={selectStyle}
                >
                  {yearOptions.map(year => (
                    <option key={`year2-${year}`} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <label style={{ ...labelStyle, textAlign: 'center', marginBottom: '10px' }}>Number of Games:</label>
            <input 
              type="number" 
              min="1" 
              max="50"
              value={numGames} 
              onChange={(e) => {
                // Only set the number if the input isn't empty
                if (e.target.value == '') {
                  setNumGames(1)
                } else if(Number(e.target.value) > 50){
                  setNumGames(50)
                } else {
                  setNumGames(Number(e.target.value)) // Default to 1 if empty
                }
              }}
              style={{ ...inputStyle, maxWidth: '200px', margin: '0 auto', textAlign: 'center' }}
            />
        </div>

          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <Button 
              label={loading ? "Running Simulation..." : "Run Simulation"} 
              onClick={runSimulation} 
            />
          </div>

          {error && (
            <div style={errorStyle}>
              <strong>Error:</strong> {error}
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                Backend server is not online right now.
              </div>
            </div>
          )}
        </div>

        {results && (
          <div style={{...cardStyle, marginTop: '30px'}}>
            <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>Simulation Results</h2>
            
            <div style={resultsSummaryStyle}>
              <div style={teamResultStyle}>
                <div style={{
                  backgroundColor: teamColors[team1]?.primary || '#003300',
                  color: teamColors[team1]?.secondary || 'white',
                  padding: '10px',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}>
                  {teamNames[team1] || team1} ({year1})
                </div>
                <div style={{
                  padding: '15px',
                  backgroundColor: '#002200',
                  borderRadius: '0 0 6px 6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {(results.win_probability * 100).toFixed(1)}%
                  </div>
                  <div style={{ marginTop: '5px', color: '#aaa' }}>
                    Win Probability
                  </div>
                  <div style={{ marginTop: '15px', fontSize: '18px' }}>
                    Avg. Score: {results.avg_score_team1?.toFixed(1) || '0.0'}
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '20px',
                fontWeight: 'bold',
                margin: '0 15px',
              }}>
                VS
              </div>

              <div style={teamResultStyle}>
                <div style={{
                  backgroundColor: teamColors[team2]?.primary || '#003300',
                  color: teamColors[team2]?.secondary || 'white',
                  padding: '10px',
                  borderRadius: '6px 6px 0 0',
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}>
                  {teamNames[team2] || team2} ({year2})
                </div>
                <div style={{
                  padding: '15px',
                  backgroundColor: '#002200',
                  borderRadius: '0 0 6px 6px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                    {((1 - results.win_probability) * 100).toFixed(1)}%
                  </div>
                  <div style={{ marginTop: '5px', color: '#aaa' }}>
                    Win Probability
                  </div>
                  <div style={{ marginTop: '15px', fontSize: '18px' }}>
                    Avg. Score: {results.avg_score_team2?.toFixed(1) || '0.0'}
                  </div>
                </div>
              </div>
            </div>

            {numGames > 1 && (
              <>
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ color: '#ffffff', marginBottom: '15px' }}>Game Results</h3>
                  
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    backgroundColor: '#001800',
                    borderRadius: '6px',
                    padding: '10px',
                    border: '1px solid #003300',
                  }}>
                    {results.team1_scores.map((score1: number, index: number) => {
                      const score2 = results.team2_scores[index]
                      const winner = score1 > score2 ? team1 : score1 < score2 ? team2 : 'Tie'
                      
                      // Determine if team colors are too dark and should be lightened
                      const team1Color = isDarkColor(teamColors[team1]?.secondary) ? '#ffffff' : teamColors[team1]?.secondary || 'white'
                      const team2Color = isDarkColor(teamColors[team2]?.secondary) ? '#ffffff' : teamColors[team2]?.secondary || 'white'
                      
                      return (
                        <div key={index} style={{
                          padding: '8px 12px',
                          borderBottom: index < results.team1_scores.length - 1 ? '1px solid #003300' : 'none',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}>
                          <span>Game {index + 1}:</span>
                          <span>
                            <span style={{
                              color: team1Color,
                              fontWeight: winner === team1 ? 'bold' : 'normal',
                            }}>
                              {score1}
                            </span>
                            {' - '}
                            <span style={{
                              color: team2Color,
                              fontWeight: winner === team2 ? 'bold' : 'normal',
                            }}>
                              {score2}
                            </span>
                            {' '}
                            <span style={{ color: '#777', fontSize: '14px' }}>
                              ({winner})
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                
                {/* Scores Chart Component */}
                <div style={{
                  marginTop: '30px',
                  backgroundColor: '#001800',
                  borderRadius: '6px',
                  padding: '20px',
                  border: '1px solid #003300',
                }}>
                  <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>Scores Chart</h2>
                  <ScoresChart 
                    team1={team1} 
                    team2={team2}
                    team1Scores={results.team1_scores}
                    team2Scores={results.team2_scores}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Styles
const cardStyle = {
  backgroundColor: '#001800',
  borderRadius: '8px',
  padding: '25px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  border: '1px solid #003300',
}

const formContainerStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '30px',
  justifyContent: 'space-between' as const,
  marginBottom: '20px',
}

const formColumnStyle = {
  flex: '1 1 300px',
}

const formGroupStyle = {
  marginBottom: '20px',
}

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  color: '#aaa',
  fontSize: '14px',
}

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#002800',
  color: 'white',
  border: '1px solid #004400',
  borderRadius: '4px',
  fontSize: '16px',
  fontFamily: 'monospace',
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: '#002800',
  color: 'white',
  border: '1px solid #004400',
  borderRadius: '4px',
  fontSize: '16px',
  fontFamily: 'monospace',
}

const errorStyle = {
  marginTop: '20px',
  padding: '15px',
  backgroundColor: 'rgba(200, 0, 0, 0.1)',
  border: '1px solid rgba(200, 0, 0, 0.3)',
  borderRadius: '4px',
  color: '#ff5555',
}

const resultsSummaryStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap' as const,
}

const teamResultStyle = {
  flex: '1 1 200px',
  maxWidth: '250px',
  borderRadius: '6px',
  overflow: 'hidden',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
}