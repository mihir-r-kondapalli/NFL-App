import React from 'react';
import { CoachProbData } from '../utils/coachProbs';
import { formatProbability, getDominantPlayType, getPlayTypeByIndex } from '../utils/coachProbsUtils';

interface TableProps {
  data: CoachProbData[];
  playTypeColors: Record<string, string>;
  playTypeMap: Record<number, string>;
  theme: any;
  highlightedYardline: number | null;
  handleYardlineClick: (yardline: number) => void;
}

const CoachProbsTable: React.FC<TableProps> = ({
  data,
  playTypeColors,
  playTypeMap,
  theme,
  highlightedYardline,
  handleYardlineClick
}) => {
  return (
    <div style={{ overflowX: 'auto', marginTop: '10px' }}>
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse', 
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <thead>
          <tr>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left',
              position: 'sticky',
              top: 0
            }}>
              Yardline
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Run %
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Pass %
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Kick %
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Punt %
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Dominant Play
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              Optimal Play
            </th>
            <th style={{ 
              padding: '12px 8px', 
              backgroundColor: theme.colors.accent.primary, 
              color: theme.colors.button.text,
              textAlign: 'left'
            }}>
              EP
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const isEven = index % 2 === 0;
            const dominantPlay = getDominantPlayType(item);
            const optimalPlay = item.opt_choice ? getPlayTypeByIndex(item.opt_choice, playTypeMap) : 'Unknown';
            const isOptimalMatchesDominant = item.opt_choice && 
              ((item.opt_choice === 1 && dominantPlay.type === 'Run') || 
               (item.opt_choice === 2 && dominantPlay.type === 'Pass') || 
               (item.opt_choice === 3 && dominantPlay.type === 'Kick') || 
               (item.opt_choice === 4 && dominantPlay.type === 'Punt'));
            
            return (
              <tr 
                key={item.yardline}
                style={{ 
                  backgroundColor: isEven ? theme.colors.background.dark : theme.colors.background.main,
                  cursor: 'pointer'
                }}
                onClick={() => handleYardlineClick(item.yardline)}
                className={highlightedYardline === item.yardline ? 'highlighted-row' : ''}
              >
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  fontWeight: '600',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {item.yardline}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  color: item.opt_choice === 1 ? playTypeColors.opt_marker : 'inherit',
                  fontWeight: item.opt_choice === 1 ? '600' : 'normal',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {formatProbability(item.run_prob)}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  color: item.opt_choice === 2 ? playTypeColors.opt_marker : 'inherit',
                  fontWeight: item.opt_choice === 2 ? '600' : 'normal',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {formatProbability(item.pass_prob)}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  color: item.opt_choice === 3 ? playTypeColors.opt_marker : 'inherit',
                  fontWeight: item.opt_choice === 3 ? '600' : 'normal',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {formatProbability(item.kick_prob)}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  color: item.opt_choice === 4 ? playTypeColors.opt_marker : 'inherit',
                  fontWeight: item.opt_choice === 4 ? '600' : 'normal',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {formatProbability(item.punt_prob)}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  fontWeight: '500',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {dominantPlay.type} ({formatProbability(dominantPlay.prob)})
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  color: playTypeColors.opt_marker,
                  fontWeight: '600',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {optimalPlay}
                  {optimalPlay !== 'Unknown' && isOptimalMatchesDominant && (
                    <span style={{ marginLeft: '5px', color: theme.colors.text.secondary }}>✓</span>
                  )}
                  {optimalPlay !== 'Unknown' && !isOptimalMatchesDominant && (
                    <span style={{ marginLeft: '5px', color: theme.colors.error }}>≠</span>
                  )}
                </td>
                <td style={{ 
                  padding: '10px 8px', 
                  borderBottom: '1px solid #ddd',
                  backgroundColor: highlightedYardline === item.yardline ? `${theme.colors.accent.primary}33` : 'inherit'
                }}>
                  {item.ep !== null ? item.ep.toFixed(2) : 'N/A'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ 
        fontSize: '12px', 
        marginTop: '6px', 
        color: theme.colors.text.secondary, 
        fontFamily: 'monospace' 
        }}>
        <span style={{ marginRight: '12px' }}>✓ Optimal play matches dominant coach tendency</span>
        <span>≠ Optimal play differs from dominant coach tendency</span>
    </p>

    </div>
  );
};

export default CoachProbsTable;