'use client'

import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import CoachProbsFilters from '../components/CoachProbsFilters'
import CoachProbsChart from '../components/CoachProbsChart'
import CoachProbsTable from '../components/CoachProbsTable'
import { teamNames } from '../data/team_names'
import { CoachProbData, FilterState, PresetScenario } from '../utils/coachProbs'
import { filterDataByRange, getValidDistance, normalizeYardlineRange } from '../utils/coachProbsUtils'

export default function CoachProbsPage() {
  // State variables
  const [teams, setTeams] = useState<string[]>([])
  const [years, setYears] = useState<number[]>([])
  const [downs, setDowns] = useState<number[]>([1, 2, 3, 4])
  
  // Flag to prevent initial data loading
  const [hasInitiatedDataFetch, setHasInitiatedDataFetch] = useState<boolean>(false)
  
  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    selectedTeam: '',
    selectedYear: 2024,
    selectedIsDefense: false,
    selectedDown: 1,
    selectedDistance: 10,
    yardlineRange: { start: 1, end: 100 }
  })
  
  // Chart data
  const [chartData, setChartData] = useState<CoachProbData[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  
  // UI state
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  const [showOptimalPlayOnly, setShowOptimalPlayOnly] = useState<boolean>(false)
  const [highlightedYardline, setHighlightedYardline] = useState<number | null>(null)
  
  // Hardcoded values
  const allTeams = [
    'ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB',
    'HOU','IND','JAX','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG',
    'NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'
  ];
  
  // Year range
  const yearOptions = [2021, 2022, 2023, 2024];

  // Play type mapping
  const playTypeMap: {[key: number]: string} = {
    1: 'Run',
    2: 'Pass',
    3: 'Kick',
    4: 'Punt'
  };

  // Play type colors
  const playTypeColors = {
    run_prob: '#4CAF50',     // Green
    pass_prob: '#2196F3',    // Blue
    kick_prob: '#FF9800',    // Orange
    punt_prob: '#9C27B0',    // Purple
    opt_marker: '#FF0000'    // Red for optimal play marker
  };

  // Presets for common scenarios
  const presets: PresetScenario[] = [
    { name: "Red Zone", down: 1, distance: 10, range: { start: 1, end: 20 } },
    { name: "Goal Line", down: 4, distance: 1, range: { start: 1, end: 5 } },
    { name: "Mid Field", down: 1, distance: 10, range: { start: 40, end: 60 } },
    { name: "Own Territory", down: 1, distance: 10, range: { start: 60, end: 99 } },
    { name: "4th & Short", down: 4, distance: 2, range: { start: 20, end: 90 } }
  ];

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

  // Fetch available teams and years on component mount
  useEffect(() => {
    // Set teams from hardcoded list
    setTeams(allTeams);
    setFilterState((prev: FilterState) => ({ ...prev, selectedTeam: 'PHI' }));
    
    // Set years from hardcoded options
    setYears(yearOptions);
    setFilterState((prev: FilterState) => ({ ...prev, selectedYear: yearOptions[yearOptions.length - 1] }));
    
    // Set default distance
    setFilterState((prev: FilterState) => ({ ...prev, selectedDistance: getValidDistance(prev.selectedDown, 10) }));
  }, []);

  // Update filter state helper
  const updateFilterState = (updates: Partial<FilterState>) => {
    setFilterState((prev: FilterState) => {
      const newState = { ...prev, ...updates };
      
      // Normalize yardline range if it was updated
      if (updates.yardlineRange) {
        const normalized = normalizeYardlineRange(
          updates.yardlineRange.start, 
          updates.yardlineRange.end
        );
        newState.yardlineRange = normalized;
      }
      
      return newState;
    });
  };

  // Handle yardline click to highlight a specific yardline
  const handleYardlineClick = (yardline: number) => {
    setHighlightedYardline(highlightedYardline === yardline ? null : yardline);
  };

  // Apply preset configurations
  const applyPreset = (preset: PresetScenario) => {
    updateFilterState({
      selectedDown: preset.down,
      selectedDistance: preset.distance,
      yardlineRange: preset.range
    });
    // Mark that user wants to fetch data
    setHasInitiatedDataFetch(true);
    // Fetch new data with these parameters
    fetchCoachProbData();
  };
  
  // Toggle between chart and table view
  const toggleViewMode = () => {
    setViewMode(viewMode === 'chart' ? 'table' : 'chart');
  };

  // Fetch coach probability data
  const fetchCoachProbData = async () => {
    setLoading(true);
    setError(null);
    
    // Mark that user has initiated a data fetch
    setHasInitiatedDataFetch(true);
    
    try {
      const response = await fetch('/api/fetchDecisions', {
        method: 'POST',
        body: JSON.stringify({ 
          team: filterState.selectedTeam, 
          year: filterState.selectedYear, 
          isDefense: filterState.selectedIsDefense, 
          down: filterState.selectedDown, 
          distance: filterState.selectedDistance 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    
      const { data, error } = await response.json();
    
      if (error) throw error;
    
      if (data && data.length > 0) {
        // Filter by yardline range
        const filteredData = filterDataByRange(
          data, 
          filterState.yardlineRange.start, 
          filterState.yardlineRange.end
        );
        
        // Process data for display
        const processedData = filteredData.map(item => ({
          ...item,
          run_prob: parseFloat(item.run_prob.toString()),
          pass_prob: parseFloat(item.pass_prob.toString()),
          kick_prob: parseFloat(item.kick_prob.toString()),
          punt_prob: parseFloat(item.punt_prob.toString()),
          ep: item.ep !== null ? parseFloat(item.ep.toString()) : null
        }));
        
        setChartData(processedData);
      } else {
        setChartData([]);
        setError('No data available for the selected filters');
      }
      
    } catch (error) {
      console.error('Error fetching coach probability data:', error);
      setError('Failed to load coach probability data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change, but only if user has already initiated a fetch
  useEffect(() => {
    // Only fetch if we have necessary filters and user has already initiated a fetch
    if (!filterState.selectedTeam || !filterState.selectedYear || !filterState.selectedDown || !filterState.selectedDistance || !hasInitiatedDataFetch) {
      return;
    }
    
    fetchCoachProbData();
  }, [
    filterState.selectedTeam, 
    filterState.selectedYear, 
    filterState.selectedIsDefense, 
    filterState.selectedDown, 
    filterState.selectedDistance
  ]);

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
          Strategy
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: theme.colors.text.secondary, 
          marginBottom: '30px' 
        }}>
          Analyze how coaches make decisions across different field positions, downs, and distances.
        </p>

        {/* Filters Section */}
        <div style={{...cardStyle, backgroundColor: theme.colors.background.main}}>
          <CoachProbsFilters 
            allTeams={allTeams}
            yearOptions={yearOptions}
            downs={downs}
            filterState={filterState}
            setFilterState={updateFilterState}
            presets={presets}
            loading={loading}
            applyPreset={applyPreset}
            fetchData={fetchCoachProbData}
            viewMode={viewMode}
            toggleViewMode={toggleViewMode}
            showOptimalPlayOnly={showOptimalPlayOnly}
            setShowOptimalPlayOnly={setShowOptimalPlayOnly}
            theme={theme}
          />

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
            Coach Decision Probabilities by Yardline
          </h2>
          <p style={{ 
            color: theme.colors.text.secondary, 
            marginBottom: '20px', 
            fontSize: '16px',
            fontWeight: '500'
          }}>
            {teamNames[filterState.selectedTeam] || filterState.selectedTeam} ({filterState.selectedYear}) - 
            {filterState.selectedIsDefense ? ' Defense' : ' Offense'}, 
            Down: {filterState.selectedDown}, Distance: {filterState.selectedDistance} yards
          </p>

          {!hasInitiatedDataFetch ? (
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
                Select filters and click "Update Chart" to load data
              </p>
            </div>
          ) : loading ? (
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
                No data available for the selected filters
              </p>
            </div>
          ) : viewMode === 'chart' ? (
            // Chart View
            <CoachProbsChart 
              data={chartData}
              playTypeColors={playTypeColors}
              playTypeMap={playTypeMap}
              theme={theme}
              showOptimalPlayOnly={showOptimalPlayOnly}
              highlightedYardline={highlightedYardline}
              handleYardlineClick={handleYardlineClick}
            />
          ) : (
            // Table View
            <CoachProbsTable 
              data={chartData}
              playTypeColors={playTypeColors}
              playTypeMap={playTypeMap}
              theme={theme}
              highlightedYardline={highlightedYardline}
              handleYardlineClick={handleYardlineClick}
            />
          )}

          <div style={{ 
            marginTop: '15px', 
            display: 'flex', 
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            fontSize: '14px',
            color: theme.colors.text.secondary
          }}>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: playTypeColors.run_prob,
                marginRight: '5px'
              }}></span>
              Run
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: playTypeColors.pass_prob,
                marginRight: '5px'
              }}></span>
              Pass
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: playTypeColors.kick_prob,
                marginRight: '5px'
              }}></span>
              Kick
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: playTypeColors.punt_prob,
                marginRight: '5px'
              }}></span>
              Punt
            </div>
            <div>
              <svg width="15" height="15" viewBox="0 0 15 15" style={{ verticalAlign: 'middle', marginRight: '5px' }}>
                <polygon
                  points="7.5,0 9.5,5 15,5 10.5,8 12,15 7.5,11 3,15 4.5,8 0,5 5.5,5"
                  fill={playTypeColors.opt_marker}
                />
              </svg>
              Optimal Play
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
            About Coach Decision Probabilities
          </h2>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            Coach Decision Probabilities show how often a coach chooses each play type (run, pass, kick, or punt) based on field position, down, and distance.
          </p>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            The stacked column chart displays these probabilities for each yardline, with each color representing a different play type.
          </p>
          
          <p style={{ marginBottom: '15px', lineHeight: '1.5' }}>
            The star markers indicate the optimal play choice according to the expected points model, allowing you to compare actual coaching decisions with analytically optimal choices.
          </p>
          
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: theme.colors.background.dark, borderRadius: '4px', border: `1px solid ${theme.colors.accent.primary}` }}>
            <h3 style={{ color: theme.colors.text.primary, marginBottom: '10px', fontSize: '16px', fontWeight: 'bold' }}>Note about Coach Decision Models</h3>
            <ul style={{ color: theme.colors.text.secondary, paddingLeft: '20px', lineHeight: '1.5' }}>
              <li style={{ marginBottom: '8px' }}>These probabilities are based on historical data of each team's play-calling tendencies in specific game situations.</li>
              <li style={{ marginBottom: '8px' }}>Optimal play choices are calculated using the 4th & Sim Expected Points model, which accounts for team-specific offensive and defensive capabilities.</li>
              <li style={{ marginBottom: '8px' }}>Discrepancies between actual coaching decisions and optimal plays may reveal strategic tendencies, risk aversion, or situational preferences that aren't captured by expected points alone.</li>
            </ul>
            <p style={{ color: theme.colors.text.secondary, marginTop: '10px' }}>
              Using this visualization, coaches and analysts can identify potential opportunities to optimize play-calling across different field positions and game situations.
            </p>
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

const errorStyle = {
  marginTop: '20px',
  padding: '15px',
  borderRadius: '4px',
}