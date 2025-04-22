import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CoachProbData } from '../utils/coachProbs';
import { adjustBrightness } from '../utils/coachProbsUtils';

interface ChartProps {
  data: CoachProbData[];
  playTypeColors: Record<string, string>;
  playTypeMap: Record<number, string>;
  theme: any;
  showOptimalPlayOnly: boolean;
  highlightedYardline: number | null;
  handleYardlineClick: (yardline: number) => void;  // Changed back to match implementation
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  playTypeMap: Record<number, string>;
  playTypeColors: Record<string, string>;
  theme: any;
}

// Custom star marker for optimal play
const StarMarker = (props: any) => {
  const { x, y, payload, playTypeColors, highlightedYardline } = props;
  
  // Only render if there's an optimal play
  if (!payload.opt_choice) return null;
  
  // Only show if this yardline is not filtered out
  if (highlightedYardline !== null && payload.yardline !== highlightedYardline) {
    return null;
  }
  
  // Calculate y position based on play type
  let optPosition = 0;
  let totalBeforeOpt = 0;
  
  switch (payload.opt_choice) {
    case 1: // Run
      optPosition = payload.run_prob / 2;
      break;
    case 2: // Pass
      totalBeforeOpt = payload.run_prob;
      optPosition = totalBeforeOpt + (payload.pass_prob / 2);
      break;
    case 3: // Kick
      totalBeforeOpt = payload.run_prob + payload.pass_prob;
      optPosition = totalBeforeOpt + (payload.kick_prob / 2);
      break;
    case 4: // Punt
      totalBeforeOpt = payload.run_prob + payload.pass_prob + payload.kick_prob;
      optPosition = totalBeforeOpt + (payload.punt_prob / 2);
      break;
    default:
      return null;
  }
  
  // Calculate position within the stacked bar
  const markerY = y + (props.height * optPosition);
  
  // Render star marker
  return (
    <polygon
      points={`
        ${x + props.width/2},${markerY - 15}
        ${x + props.width/2 + 5},${markerY - 5}
        ${x + props.width/2 + 15},${markerY - 5}
        ${x + props.width/2 + 7},${markerY}
        ${x + props.width/2 + 10},${markerY + 10}
        ${x + props.width/2},${markerY + 5}
        ${x + props.width/2 - 10},${markerY + 10}
        ${x + props.width/2 - 7},${markerY}
        ${x + props.width/2 - 15},${markerY - 5}
        ${x + props.width/2 - 5},${markerY - 5}
      `}
      fill={playTypeColors.opt_marker}
      stroke="none"
    />
  );
};

const CustomTooltip = ({ active, payload, label, playTypeMap, playTypeColors, theme }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    // Find optimal play text
    const optChoice = payload[0]?.payload?.opt_choice;
    const optPlayText = optChoice ? `Optimal Play: ${playTypeMap[optChoice] || 'Unknown'}` : 'No optimal play data';
    
    // Get EP value
    const epValue = payload[0]?.payload?.ep;
    
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
          // Skip the optimal choice marker which is just for display
          if (entry.dataKey === 'opt_marker') return null;
          
          // Convert decimal to percentage (multiply by 100)
          const percentValue = (entry.value * 100).toFixed(1);
          
          return (
            <p key={index} style={{ 
              margin: index === payload.length - 1 ? '0' : '0 0 5px 0',
              color: entry.color,
              fontWeight: '500'
            }}>
              {entry.name}: {percentValue}%
            </p>
          );
        })}
        <div style={{ 
          marginTop: '8px', 
          paddingTop: '8px', 
          borderTop: `1px dashed ${theme.colors.chart.grid}`,
          color: playTypeColors.opt_marker,
          fontWeight: 'bold'
        }}>
          {optPlayText}
        </div>
        {epValue !== null && (
          <div style={{ 
            marginTop: '4px',
            color: theme.colors.text.secondary,
            fontWeight: '500'
          }}>
            Expected Points: {typeof epValue === 'number' ? epValue.toFixed(2) : 'N/A'}
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CoachProbsChart: React.FC<ChartProps> = ({
  data,
  playTypeColors,
  playTypeMap,
  theme,
  showOptimalPlayOnly,
  highlightedYardline,
  handleYardlineClick
}) => {
  // No need for initialization useEffect since parent component's
  // handleYardlineClick already toggles between value and null

  return (
    <div style={{ height: '500px', marginTop: '10px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 10, bottom: 30 }}
          stackOffset="expand"
          onClick={(data) => data && data.activePayload && handleYardlineClick(data.activePayload[0].payload.yardline)}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.chart.grid} />
          <XAxis 
            dataKey="yardline" 
            stroke={theme.colors.chart.axis} 
            tick={{ fill: theme.colors.text.primary }}
            label={{ 
              value: 'Yardline', 
              position: 'bottom', 
              offset: 20,  // Increased offset to move label away from chart
              fill: theme.colors.text.primary
            }}
          />
          <YAxis
            stroke={theme.colors.chart.axis}
            tick={{ fill: theme.colors.text.primary }}
            label={{
              value: 'Probability (%)',
              angle: -90,
              position: 'insideLeft',
              fill: theme.colors.text.primary
            }}
            tickFormatter={(tick) => `${Math.round(tick * 100)}%`}
          />

          <Tooltip content={<CustomTooltip 
            playTypeMap={playTypeMap} 
            playTypeColors={playTypeColors} 
            theme={theme} 
          />} />
          
          {/* Use EITHER the Legend with payload OR name props on Bar, not both */}
          {/* Hide the default legend - we'll use the custom one from the parent */}
          <Legend 
            content={() => null}
          />
          
          {/* Stacked bars for probabilities */}
          <Bar 
            dataKey="run_prob" 
            stackId="a" 
            fill={playTypeColors.run_prob} 
            name="Run"
          >
            {data.map((entry, index) => {
              // Highlight bar if this is the optimal play
              const isOptimal = entry.opt_choice === 1;
              return (
                <Cell 
                  key={`cell-run-${index}`} 
                  fill={isOptimal && showOptimalPlayOnly ? adjustBrightness(playTypeColors.run_prob, 50) : playTypeColors.run_prob}
                  stroke={isOptimal && showOptimalPlayOnly ? playTypeColors.opt_marker : 'none'}
                  strokeWidth={isOptimal && showOptimalPlayOnly ? 2 : 0}
                  // Highlight if this yardline is selected
                  opacity={highlightedYardline === null || entry.yardline === highlightedYardline ? 1 : 0.5}
                />
              );
            })}
          </Bar>
          <Bar 
            dataKey="pass_prob" 
            stackId="a" 
            fill={playTypeColors.pass_prob} 
            name="Pass"
          >
            {data.map((entry, index) => {
              // Highlight bar if this is the optimal play
              const isOptimal = entry.opt_choice === 2;
              return (
                <Cell 
                  key={`cell-pass-${index}`} 
                  fill={isOptimal && showOptimalPlayOnly ? adjustBrightness(playTypeColors.pass_prob, 50) : playTypeColors.pass_prob}
                  stroke={isOptimal && showOptimalPlayOnly ? playTypeColors.opt_marker : 'none'}
                  strokeWidth={isOptimal && showOptimalPlayOnly ? 2 : 0}
                  // Highlight if this yardline is selected
                  opacity={highlightedYardline === null || entry.yardline === highlightedYardline ? 1 : 0.5}
                />
              );
            })}
          </Bar>
          <Bar 
            dataKey="kick_prob" 
            stackId="a" 
            fill={playTypeColors.kick_prob} 
            name="Kick"
          >
            {data.map((entry, index) => {
              // Highlight bar if this is the optimal play
              const isOptimal = entry.opt_choice === 3;
              return (
                <Cell 
                  key={`cell-kick-${index}`} 
                  fill={isOptimal && showOptimalPlayOnly ? adjustBrightness(playTypeColors.kick_prob, 50) : playTypeColors.kick_prob}
                  stroke={isOptimal && showOptimalPlayOnly ? playTypeColors.opt_marker : 'none'}
                  strokeWidth={isOptimal && showOptimalPlayOnly ? 2 : 0}
                  // Highlight if this yardline is selected
                  opacity={highlightedYardline === null || entry.yardline === highlightedYardline ? 1 : 0.5}
                />
              );
            })}
          </Bar>
          <Bar 
            dataKey="punt_prob" 
            stackId="a" 
            fill={playTypeColors.punt_prob} 
            name="Punt"
          >
            {data.map((entry, index) => {
              // Highlight bar if this is the optimal play
              const isOptimal = entry.opt_choice === 4;
              return (
                <Cell 
                  key={`cell-punt-${index}`} 
                  fill={isOptimal && showOptimalPlayOnly ? adjustBrightness(playTypeColors.punt_prob, 50) : playTypeColors.punt_prob}
                  stroke={isOptimal && showOptimalPlayOnly ? playTypeColors.opt_marker : 'none'}
                  strokeWidth={isOptimal && showOptimalPlayOnly ? 2 : 0}
                  // Highlight if this yardline is selected
                  opacity={highlightedYardline === null || entry.yardline === highlightedYardline ? 1 : 0.5}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CoachProbsChart;