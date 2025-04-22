// Coach probability data types
export interface CoachProbData {
  yardline: number;
  run_prob: number;
  pass_prob: number;
  kick_prob: number;
  punt_prob: number;
  opt_choice: number | null;
  ep: number | null;
}

// Props for the chart component
export interface ChartProps {
  data: CoachProbData[];
  playTypeColors: Record<string, string>;
  playTypeMap: Record<number, string>;
  theme: ThemeType;
  showOptimalPlayOnly: boolean;
  highlightedYardline: number | null;
  handleYardlineClick: (yardline: number) => void;
}

// Props for the table component
export interface TableProps {
  data: CoachProbData[];
  playTypeColors: Record<string, string>;
  playTypeMap: Record<number, string>;
  theme: ThemeType;
  highlightedYardline: number | null;
  handleYardlineClick: (yardline: number) => void;
}

// Custom tooltip props for chart
export interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  playTypeMap: Record<number, string>;
  playTypeColors: Record<string, string>;
  theme: ThemeType;
}

// Theme configuration
export interface ThemeType {
  colors: {
    background: {
      main: string;
      dark: string;
      darker: string;
    };
    text: {
      primary: string;
      secondary: string;
      light: string;
      highlight: string;
    };
    accent: {
      primary: string;
      secondary: string;
      light: string;
      highlight: string;
    };
    chart: {
      grid: string;
      axis: string;
    };
    button: {
      primary: string;
      hover: string;
      text: string;
    };
    error: string;
  };
}

// Preset scenario type
export interface PresetScenario {
  name: string;
  down: number;
  distance: number;
  range: {
    start: number;
    end: number;
  };
}

// Filter state type
export interface FilterState {
  selectedTeam: string;
  selectedYear: number;
  selectedIsDefense: boolean;
  selectedDown: number;
  selectedDistance: number;
  yardlineRange: {
    start: number;
    end: number;
  };
}

// API Response type
export interface CoachProbsApiResponse {
  data: CoachProbData[] | null;
  error: string | null;
}