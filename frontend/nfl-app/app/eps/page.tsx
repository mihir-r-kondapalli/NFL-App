'use client'

import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import Button from '../components/Button'
import { teamColors } from '../data/team_colors'
import { teamNames } from '../data/team_names'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts'

export default function EPSPage() {
  // State variables
  const [teams, setTeams] = useState<string[]>([])
  const [years, setYears] = useState<number[]>([])
  const [downs, setDowns] = useState<number[]>([1, 2, 3, 4])
  
  // Team-year-defense triplets for analysis
  const [teamPairs, setTeamPairs] = useState<{team: string, year: number, isDefense: boolean}[]>([])
  
  // Selected filters
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(2024)
  const [selectedIsDefense, setSelectedIsDefense] = useState<boolean>(false)
  const [selectedDown, setSelectedDown] = useState<number>(1)
  const [selectedDistance, setSelectedDistance] = useState<number>(10)
  
  // Chart data
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Hardcoded values
  const allTeams = [
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB',
    'HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG',
    'NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ];
  
  // Year range
  const yearOptions = [2021, 2022, 2023, 2024];

  // Define theme for better color visibility
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
  };

  // Function to get valid distance based on down and yardline constraints
  const getValidDistance = (down: number, distance: number, yardline: number = 0) => {
    // For 1st down, distance is always 10 (except near goal line)
    if (down === 1) {
      return 10;
    }
    
    // For other downs, ensure distance is within 1-20 range
    let validDistance = Math.max(1, Math.min(20, distance));
    
    // If we know the yardline, distance can never be more than yards to goal
    if (yardline > 0) {
      const yardsToGoal = 100 - yardline;
      validDistance = Math.min(validDistance, yardsToGoal);
    }
    
    return validDistance;
  };

  // Fetch available teams and years on component mount
  useEffect(() => {
    // Set teams from hardcoded list
    setTeams(allTeams);
    setSelectedTeam(allTeams[0]);
    
    // Set years from hardcoded options
    setYears(yearOptions);
    setSelectedYear(yearOptions[yearOptions.length - 1]); // Most recent year
    
    // Set default distance
    setSelectedDistance(getValidDistance(selectedDown, 10));
  }, []);

  // Update distance when down changes
  useEffect(() => {
    setSelectedDistance(getValidDistance(selectedDown, selectedDistance));
  }, [selectedDown]);

  // Add team-year-defense triplet
  const addTeamPair = () => {
    if (!selectedTeam || !selectedYear) return;
    
    // Check if triplet already exists
    const pairExists = teamPairs.some(
      pair => pair.team === selectedTeam && 
              pair.year === selectedYear && 
              pair.isDefense === selectedIsDefense
    );
    
    if (!pairExists) {
      setTeamPairs([...teamPairs, { 
        team: selectedTeam, 
        year: selectedYear,
        isDefense: selectedIsDefense
      }]);
    }
  };

  // Remove team triplet
  const removeTeamPair = (team: string, year: number, isDefense: boolean) => {
    setTeamPairs(teamPairs.filter(
      pair => !(pair.team === team && pair.year === year && pair.isDefense === isDefense)
    ));
  };

  // Fetch EPS data when filters change
  useEffect(() => {
    // Only fetch if we have selected team pairs, down and distance
    if (
      teamPairs.length === 0 ||
      !selectedDown ||
      !selectedDistance
    ) {
      return;
    }
    
    fetchEPSData();
  }, [teamPairs, selectedDown, selectedDistance]);

  // Fetch EPS data
  const fetchEPSData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Prepare an array to hold all data for all selected teams and years
      let allTeamData: any[] = [];
      
      for (const { team, year, isDefense } of teamPairs) {
        const response = await fetch('/api/fetchEPs', {
          method: 'POST',
          body: JSON.stringify({ team, year, isDefense, down: selectedDown, distance: selectedDistance }),
          headers: { 'Content-Type': 'application/json' }
        });
      
        const { data, error } = await response.json();
      
        if (error) throw error;
      
        if (data && data.length > 0) {
          const displayName = `${team} ${year} ${isDefense ? 'DEF' : 'OFF'}`;
      
          // Transform data
          const transformedData = data.map((row: any) => ({
            yardline: row.yardline,
            [displayName]: row.ep
          }));
      
          allTeamData.push({ team, year, isDefense, displayName, data: transformedData });
        }
      }      
      
      // Process the data for the chart
      processChartData(allTeamData);
      
    } catch (error) {
      console.error('Error fetching EPS data:', error);
      setError('Failed to load expected points data. Please try again later.');
      setLoading(false);
    }
  };

  // Process data for the chart
  const processChartData = (teamDataArray: any[]) => {
    if (teamDataArray.length === 0) {
      setChartData([]);
      setLoading(false);
      return;
    }
    
    // Create an object to hold the merged data
    // Keys will be yardlines, values will be objects with team-year:ep mappings
    const mergedData: Record<number, Record<string, number>> = {};
    
    // Populate all possible yardlines (0 to 100)
    for (let i = 0; i <= 100; i++) {
      mergedData[i] = {};
    }
    
    // Merge data from all teams and years
    teamDataArray.forEach(({ displayName, data }) => {
      data.forEach((item: any) => {
        if (mergedData[item.yardline]) {
          mergedData[item.yardline][displayName] = item[displayName];
        }
      });
    });
    
    // Convert the merged data to the array format needed by Recharts
    const chartData = Object.entries(mergedData).map(([yardline, values]) => {
      return {
        yardline: parseInt(yardline),
        ...values
      };
    });
    
    // Sort by yardline
    chartData.sort((a, b) => a.yardline - b.yardline);
    
    setChartData(chartData);
    setLoading(false);
  };

  // Get line color based on team, year, and side of ball
  const getLineColor = (team: string, isDefense: boolean) => {
    const baseColor = teamColors[team]?.primary || theme.colors.accent.primary;
    
    // For defense, make the line slightly darker/different
    if (isDefense) {
      // Darken the color by 30%
      return adjustColor(baseColor, -30);
    }
    
    return baseColor;
  };
  
  // Helper function to adjust color brightness
  const adjustColor = (color: string, percent: number) => {
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

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
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
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Yardline: {label}</p>
          {payload.map((entry: any, index: number) => {
            // Parse team, year and side from entry name
            const nameParts = entry.name.split(' ');
            const isDefense = nameParts[nameParts.length - 1] === 'DEF';
            const team = nameParts[0];
            
            return (
              <p key={index} style={{ 
                margin: index === payload.length - 1 ? '0' : '0 0 5px 0',
                color: entry.color,
                fontWeight: '500'
              }}>
                {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Find min and max EP values for better Y-axis range
  const allEpValues = chartData.flatMap(point => 
    Object.entries(point)
      .filter(([key]) => key !== 'yardline')
      .map(([_, value]) => value as number)
  );
  
  const minEp = allEpValues.length > 0 ? Math.min(...allEpValues, 0) : 0;
  const maxEp = allEpValues.length > 0 ? Math.max(...allEpValues, 7) : 7;
  
  // Round to nearest integer and add padding
  const yAxisMin = Math.floor(minEp) - 1;
  const yAxisMax = Math.ceil(maxEp) + 1;

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
          Expected Points (EPs)
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: theme.colors.text.secondary, 
          marginBottom: '30px' 
        }}>
          Analyze how field position affects expected points across teams, seasons, downs, and distances.
        </p>

        <div style={{...cardStyle, backgroundColor: theme.colors.background.main}}>
          <h2 style={{ 
            color: theme.colors.text.primary, 
            marginBottom: '20px',
            fontWeight: 'bold'
          }}>
            Filters
          </h2>
          
          <div style={formContainerStyle}>
            {/* Team-Year-Defense Selection */}
            <div style={formColumnStyle}>
              <div style={formGroupStyle}>
                <label style={{...labelStyle, color: theme.colors.text.secondary}}>
                  Add Team Analysis:
                </label>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <select 
                    value={selectedTeam} 
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    style={{
                      ...selectStyle, 
                      flex: 3,
                      backgroundColor: theme.colors.accent.primary,
                      color: theme.colors.button.text
                    }}
                  >
                    <option value="" disabled>Select Team</option>
                    {allTeams.map(team => (
                      <option key={team} value={team}>
                        {teamNames[team] || team}
                      </option>
                    ))}
                  </select>
                  
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    style={{
                      ...selectStyle, 
                      flex: 2,
                      backgroundColor: theme.colors.accent.primary,
                      color: theme.colors.button.text
                    }}
                  >
                    <option value="" disabled>Year</option>
                    {yearOptions.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedIsDefense ? 'defense' : 'offense'}
                    onChange={(e) => setSelectedIsDefense(e.target.value === 'defense')}
                    style={{
                      ...selectStyle,
                      flex: 2,
                      backgroundColor: theme.colors.accent.primary,
                      color: theme.colors.button.text
                    }}
                  >
                    <option value="offense">Offense</option>
                    <option value="defense">Defense</option>
                  </select>
                  
                  <button 
                    onClick={addTeamPair}
                    style={{ 
                      backgroundColor: theme.colors.button.primary, 
                      color: theme.colors.button.text, 
                      border: 'none', 
                      padding: '0 15px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '22px',
                      fontWeight: 'bold'
                    }}
                  >
                    +
                  </button>
                </div>
                
                {/* Selected Team-Year-Defense Triplets */}
                <div style={{ 
                  maxHeight: '240px', 
                  overflowY: 'auto',
                  backgroundColor: theme.colors.background.dark,
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.accent.primary}`,
                  padding: '8px'
                }}>
                  {teamPairs.length === 0 ? (
                    <div style={{ 
                      color: theme.colors.text.secondary, 
                      padding: '10px', 
                      textAlign: 'center' 
                    }}>
                      No teams selected. Add at least one team to analyze data.
                    </div>
                  ) : (
                    teamPairs.map(({ team, year, isDefense }, index) => {
                      const baseColor = teamColors[team]?.primary || theme.colors.accent.primary;
                      
                      return (
                        <div key={index} style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px',
                          marginBottom: '8px',
                          borderRadius: '4px',
                          backgroundColor: `${baseColor}22`, // Very light background
                          borderLeft: `5px solid ${isDefense ? adjustColor(baseColor, -30) : baseColor}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}>
                          <span style={{ fontSize: '16px', fontWeight: '500' }}>
                            <strong style={{ 
                              color: teamColors[team]?.primary || theme.colors.accent.primary,
                              marginRight: '6px'
                            }}>
                              {teamNames[team] || team}
                            </strong>
                            {year} - {isDefense ? 'Defense' : 'Offense'}
                          </span>
                          <button 
                            onClick={() => removeTeamPair(team, year, isDefense)}
                            style={{ 
                              backgroundColor: 'transparent', 
                              color: theme.colors.error, 
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '20px',
                              fontWeight: 'bold',
                              padding: '0 8px'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ 
                  marginTop: '5px', 
                  fontSize: '14px', 
                  color: theme.colors.text.secondary,
                  fontWeight: '500'
                }}>
                  {teamPairs.length} team {teamPairs.length === 1 ? 'selection' : 'selections'}
                </div>
              </div>
            </div>

            <div style={formColumnStyle}>
              {/* Down and Distance Selection */}
              <div style={formGroupStyle}>
                <label style={{...labelStyle, color: theme.colors.text.secondary}}>Down:</label>
                <select 
                  value={selectedDown} 
                  onChange={(e) => setSelectedDown(Number(e.target.value))}
                  style={{
                    ...selectStyle,
                    backgroundColor: theme.colors.accent.primary,
                    color: theme.colors.button.text
                  }}
                >
                  {downs.map(down => (
                    <option key={down} value={down}>{down}</option>
                  ))}
                </select>
                {selectedDown === 1 && (
                  <div style={{ 
                    marginTop: '5px', 
                    fontSize: '14px', 
                    color: theme.colors.text.secondary,
                    fontStyle: 'italic'
                  }}>
                    First down is always 10 yards
                  </div>
                )}
              </div>

              <div style={formGroupStyle}>
                <label style={{...labelStyle, color: theme.colors.text.secondary}}>Distance:</label>
                <input
                  type="number"
                  value={selectedDistance}
                  onChange={(e) => setSelectedDistance(getValidDistance(selectedDown, Number(e.target.value)))}
                  style={{
                    ...selectStyle,
                    backgroundColor: selectedDown === 1 ? '#cccccc' : theme.colors.accent.primary,
                    color: theme.colors.button.text
                  }}
                  min={1}
                  max={20}
                  disabled={selectedDown === 1} // Disable for 1st down since it's always 10 yards
                />
                {selectedDown !== 1 && (
                  <div style={{ 
                    marginTop: '5px', 
                    fontSize: '14px', 
                    color: theme.colors.text.secondary,
                    fontStyle: 'italic'
                  }}>
                    Distance can be 1-20 yards
                  </div>
                )}
              </div>
              
              <div style={{ marginTop: '20px', textAlign: 'center' }}>
                <Button 
                  label={loading ? "Loading Data..." : "Update Chart"} 
                  onClick={fetchEPSData} 
                />
              </div>
            </div>
          </div>

          {error && (
            <div style={{
              ...errorStyle,
              backgroundColor: `${theme.colors.error}22`,
              border: `1px solid ${theme.colors.error}`,
              color: theme.colors.error
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Chart Section */}
        <div style={{...cardStyle, marginTop: '30px', backgroundColor: theme.colors.background.main}}>
          <h2 style={{ 
            color: theme.colors.text.primary, 
            marginBottom: '5px',
            fontWeight: 'bold'
          }}>
            Expected Points by Yardline
          </h2>
          <p style={{ 
            color: theme.colors.text.secondary, 
            marginBottom: '20px', 
            fontSize: '16px',
            fontWeight: '500'
          }}>
            Down: {selectedDown}, Distance: {selectedDistance} yards
          </p>

          {loading ? (
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
                Loading data...
              </p>
            </div>
          ) : chartData.length === 0 ? (
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
                {teamPairs.length === 0
                  ? "Please add at least one team to analyze"
                  : "No data available for the selected filters"}
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
                  dataKey="yardline" 
                  stroke={theme.colors.chart.axis} 
                  tick={{ fill: theme.colors.text.primary }}
                  label={{ 
                    value: 'Yardline', 
                    position: 'bottom', 
                    offset: 0,
                    fill: theme.colors.text.primary
                  }} 
                  domain={[0, 100]}
                />
                <YAxis
                  stroke={theme.colors.chart.axis}
                  tick={{ fill: theme.colors.text.primary }}
                  label={{
                    value: 'Expected Points',
                    angle: -90,
                    position: 'insideLeft',
                    fill: theme.colors.text.primary
                  }}
                  domain={[Math.floor(yAxisMin), Math.ceil(yAxisMax)]}
                  allowDecimals={false}                       // 👈 prevent decimal ticks
                  tickFormatter={(tick) => Math.round(tick).toString()} // 👈 force integer formatting
                />

                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  wrapperStyle={{ paddingBottom: '10px' }}
                />
                
                {/* Goal lines at 0 and 100 */}
                <ReferenceLine x={0} stroke="#ff0000" strokeWidth={2} strokeDasharray="3 3" />
                <ReferenceLine x={100} stroke="#ff0000" strokeWidth={2} strokeDasharray="3 3" />
                
                {/* Midfield line */}
                <ReferenceLine x={50} stroke={theme.colors.chart.axis} strokeDasharray="3 3" />
                
                {/* Zero expected points line */}
                <ReferenceLine y={0} stroke={theme.colors.chart.axis} strokeWidth={1} strokeDasharray="3 3" />
                
                {/* Generate a line for each team-year-side combination */}
                {teamPairs.map(({ team, year, isDefense }) => {
                  const displayName = `${team} ${year} ${isDefense ? 'DEF' : 'OFF'}`;
                  const lineColor = getLineColor(team, isDefense);
                  
                  // Check if data exists for this combination
                  const hasData = chartData.some(d => typeof d[displayName] === 'number');
                  
                  return hasData ? (
                    <Line
                      key={displayName}
                      type="monotone"
                      dataKey={displayName}
                      name={displayName}
                      stroke={lineColor}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 7 }}
                      // Use dashed line for defense
                      strokeDasharray={isDefense ? "5 5" : ""}
                    />
                  ) : null;
                }).filter(Boolean)}
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
                width: '12px', 
                height: '12px', 
                backgroundColor: '#ff0000',
                marginRight: '5px'
              }}></span>
              Goal Lines (0 & 100)
            </div>
            <div style={{ marginRight: '20px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: theme.colors.chart.axis,
                marginRight: '5px'
              }}></span>
              Midfield (50)
            </div>
          </div>
          
          <div style={{ 
            marginTop: '10px', 
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
                marginRight: '5px'
              }}></span>
              Offense
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '20px', 
                height: '3px', 
                backgroundColor: theme.colors.accent.primary,
                marginRight: '5px',
                backgroundImage: 'linear-gradient(to right, #00aa00 5px, transparent 5px, transparent 10px)',
                backgroundSize: '15px 3px'
              }}></span>
              Defense
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div style={{...cardStyle, marginTop: '30px', backgroundColor: theme.colors.background.main}}>
          <h2 style={{ 
            color: theme.colors.text.primary, 
            marginBottom: '15px',
            fontWeight: 'bold'
          }}>
            About Expected Points
          </h2>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            Expected Points (EP) measures the average number of points a team can expect to score from a specific field position, down, and distance.
          </p>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            A positive EP value means a team is likely to score, while a negative value suggests the opposing team is more likely to score next.
          </p>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            Field position is represented by yardline (1-99), where 1 is a team's own goal line and 99 is the opponent's goal line.
          </p>
          
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: theme.colors.background.dark, borderRadius: '4px', border: `1px solid ${theme.colors.accent.primary}` }}>
            <h3 style={{ color: theme.colors.text.primary, marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>Note about NFL Expected Points vs 4th & Sim Expected Points</h3>
            <ul style={{ color: theme.colors.text.secondary, paddingLeft: '20px', lineHeight: '1.5' }}>
              <li style={{ marginBottom: '8px' }}> The NFL Expected Points metric is overreliant on league wide data. It treats teams like the 2024 Detroit Lions the same as the 2017 Cleveland Browns. Finding the expected points of
              an individual team is impossible with traditional metrics. EPA/play does not fix this as it itself depends on the NFL EP model.</li>
              <li style={{ marginBottom: '8px' }}>The metric also ignores the strength of the defense, the EP values are too static to handle matchups.</li>
              <li style={{ marginBottom: '8px' }}>It also artificially smooths over edge cases by applying linear or GAM models that morph the metric to seem more aesthetically pleasing, ignoring real
              outliers and data points that are just as important.</li>
            </ul>
            The <strong>4th & Sim</strong> Expected Points model fixes a lot of these issues by using real, individual play distributions and play decisions. It uses dynamic programming
            algorithms to generate accurate EP values for individual offenses and defenses.
          </div>
        </div>
      </div>
    </div>
  )
}

// Styles
const cardStyle = {
  backgroundColor: '#ffffff',
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
  fontSize: '14px',
  fontWeight: '500'
}

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #004400',
  borderRadius: '4px',
  fontSize: '16px',
  fontFamily: 'monospace',
}

const errorStyle = {
  marginTop: '20px',
  padding: '15px',
  borderRadius: '4px',
}