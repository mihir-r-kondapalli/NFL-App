import { CoachProbData } from './coachProbs';

// Function to get valid distance based on down
export const getValidDistance = (down: number, distance: number): number => {
  // For other downs, ensure distance is within 1-20 range
  return Math.max(1, Math.min(20, distance));
};

// Function to format probability for display
export const formatProbability = (value: number): string => {
  return (value * 100).toFixed(1) + '%';
};

// Function to get play type by index for display
export const getPlayTypeByIndex = (index: number, playTypeMap: Record<number, string>): string => {
  return playTypeMap[index] || 'Unknown';
};

// Function to get dominant play type for a yardline
export const getDominantPlayType = (item: CoachProbData): {type: string, prob: number} => {
  const types = [
    { type: 'Run', prob: item.run_prob },
    { type: 'Pass', prob: item.pass_prob },
    { type: 'Kick', prob: item.kick_prob },
    { type: 'Punt', prob: item.punt_prob }
  ];
  
  // Sort by probability (descending)
  types.sort((a, b) => b.prob - a.prob);
  
  return types[0];
};

// Function to adjust color brightness
export const adjustBrightness = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (
    0x1000000 + 
    (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 + 
    (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 + 
    (B < 255 ? (B < 0 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

// Function to filter data by yardline range
export const filterDataByRange = (data: CoachProbData[], start: number, end: number): CoachProbData[] => {
  return data.filter(item => 
    item.yardline >= start && 
    item.yardline <= end
  );
};

// Validate and normalize yardline range
export const normalizeYardlineRange = (start: number, end: number): {start: number, end: number} => {
  const validStart = Math.max(1, Math.min(start, 100));
  const validEnd = Math.max(validStart, Math.min(end, 100));
  
  return { start: validStart, end: validEnd };
};