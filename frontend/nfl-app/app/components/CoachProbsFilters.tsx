import React from 'react';
import Button from './Button';
import { FilterState, PresetScenario } from '../utils/coachProbs';
import { teamNames } from '../data/team_names';
import { getValidDistance } from '../utils/coachProbsUtils';

interface CoachProbsFiltersProps {
  allTeams: string[];
  yearOptions: number[];
  downs: number[];
  filterState: FilterState;
  setFilterState: (state: Partial<FilterState>) => void;
  presets: PresetScenario[];
  loading: boolean;
  applyPreset: (preset: PresetScenario) => void;
  fetchData: () => void;
  viewMode: 'chart' | 'table';
  toggleViewMode: () => void;
  showOptimalPlayOnly: boolean;
  setShowOptimalPlayOnly: (show: boolean) => void;
  theme: any;
}

const CoachProbsFilters: React.FC<CoachProbsFiltersProps> = ({
  allTeams,
  yearOptions,
  downs,
  filterState,
  setFilterState,
  presets,
  loading,
  applyPreset,
  fetchData,
  viewMode,
  toggleViewMode,
  showOptimalPlayOnly,
  setShowOptimalPlayOnly,
  theme
}) => {
  // Styles
  const formContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '30px',
    justifyContent: 'space-between' as const,
    marginBottom: '20px',
  };

  const formColumnStyle = {
    flex: '1 1 300px',
  };

  const formGroupStyle = {
    marginBottom: '20px',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500' as const
  };

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #004400',
    borderRadius: '4px',
    fontSize: '16px',
    fontFamily: 'monospace',
  };

  return (
    <div>
      <h2 style={{ 
        color: theme.colors.text.primary, 
        marginBottom: '20px',
        fontWeight: 'bold'
      }}>
        Filters
      </h2>
      
      <div style={formContainerStyle}>
        <div style={formColumnStyle}>
          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>
              Select Team:
            </label>
            <select 
              value={filterState.selectedTeam} 
              onChange={(e) => setFilterState({ selectedTeam: e.target.value })}
              style={{
                ...selectStyle, 
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
          </div>

          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>
              Select Year:
            </label>
            <select 
              value={filterState.selectedYear} 
              onChange={(e) => setFilterState({ selectedYear: Number(e.target.value) })}
              style={{
                ...selectStyle, 
                backgroundColor: theme.colors.accent.primary,
                color: theme.colors.button.text
              }}
            >
              <option value="" disabled>Year</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>
              Team Type:
            </label>
            <select
              value={filterState.selectedIsDefense ? 'defense' : 'offense'}
              onChange={(e) => setFilterState({ selectedIsDefense: e.target.value === 'defense' })}
              style={{
                ...selectStyle,
                backgroundColor: theme.colors.accent.primary,
                color: theme.colors.button.text
              }}
            >
              <option value="offense">Offense</option>
              <option value="defense">Defense</option>
            </select>
          </div>
        </div>

        <div style={formColumnStyle}>
          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>Down:</label>
            <select 
              value={filterState.selectedDown} 
              onChange={(e) => {
                const down = Number(e.target.value);
                setFilterState({ 
                  selectedDown: down,
                  selectedDistance: getValidDistance(down, filterState.selectedDistance)
                });
              }}
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
          </div>

          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>Distance:</label>
            <input
              type="number"
              value={filterState.selectedDistance}
              onChange={(e) => setFilterState({ 
                selectedDistance: getValidDistance(filterState.selectedDown, Number(e.target.value))
              })}
              style={{
                ...selectStyle,
                backgroundColor: theme.colors.accent.primary,
                color: theme.colors.button.text
              }}
              min={1}
              max={20}
            />
          </div>
          
          <div style={formGroupStyle}>
            <label style={{...labelStyle, color: theme.colors.text.secondary}}>Yardline Range:</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                value={filterState.yardlineRange.start}
                onChange={(e) => setFilterState({ 
                  yardlineRange: {
                    ...filterState.yardlineRange,
                    start: Number(e.target.value)
                  }
                })}
                style={{
                  ...selectStyle,
                  flex: 1,
                  backgroundColor: theme.colors.accent.primary,
                  color: theme.colors.button.text
                }}
                min={1}
                max={100}
              />
              <span style={{ color: theme.colors.text.secondary }}>to</span>
              <input
                type="number"
                value={filterState.yardlineRange.end}
                onChange={(e) => setFilterState({ 
                  yardlineRange: {
                    ...filterState.yardlineRange,
                    end: Number(e.target.value)
                  }
                })}
                style={{
                  ...selectStyle,
                  flex: 1,
                  backgroundColor: theme.colors.accent.primary,
                  color: theme.colors.button.text
                }}
                min={1}
                max={100}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Preset Scenarios */}
      <div style={{ marginTop: '20px', marginBottom: '25px' }}>
        <label style={{...labelStyle, color: theme.colors.text.secondary, marginBottom: '10px'}}>
          Preset Scenarios:
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => applyPreset(preset)}
              style={{
                backgroundColor: theme.colors.accent.primary,
                color: theme.colors.button.text,
                border: 'none',
                padding: '8px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* View Options */}
      <div style={{ marginTop: '20px', marginBottom: '25px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px' }}>
          <div>
            <label style={{ 
              marginRight: '10px', 
              fontSize: '14px', 
              color: theme.colors.text.secondary 
            }}>
              View Mode:
            </label>
            <button
              onClick={toggleViewMode}
              style={{
                backgroundColor: theme.colors.accent.primary,
                color: theme.colors.button.text,
                border: 'none',
                padding: '8px 15px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {viewMode === 'chart' ? 'Switch to Table View' : 'Switch to Chart View'}
            </button>
          </div>
          
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              fontSize: '14px',
              color: theme.colors.text.secondary,
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={showOptimalPlayOnly}
                onChange={() => setShowOptimalPlayOnly(!showOptimalPlayOnly)}
                style={{ marginRight: '8px' }}
              />
              Highlight Optimal Play Choices
            </label>
          </div>
          
          <Button 
            label={loading ? "Loading Data..." : "Update Chart"} 
            onClick={fetchData} 
          />
        </div>
      </div>
    </div>
  );
};

export default CoachProbsFilters;