import { supabase } from './supabaseClient';
import { blendDistributions } from './play_blender';

export function choosePlayType(probabilities: {
    run_prob: number,
    pass_prob: number,
    kick_prob: number,
    punt_prob: number
    }): number {
    // Extract the probabilities into an array
    const probs = [
        probabilities.run_prob,   // 1 = run
        probabilities.pass_prob,  // 2 = pass
        probabilities.kick_prob,  // 3 = kick
        probabilities.punt_prob   // 4 = punt
    ];

    // Generate a random number between 0 and 1
    const randomValue = Math.random();

    // Calculate cumulative probabilities
    let cumulativeProb = 0;

    for (let i = 0; i < probs.length; i++) {
        cumulativeProb += probs[i];
        if (randomValue <= cumulativeProb) {
        // Add 1 to convert from 0-based index to 1-based play type
        return i + 1;
        }
    }

    // Default fallback (should rarely happen, only if probabilities don't sum to 1)
    return 1;
}

function determineYardlineBin(loc: number): string {
    // For yardlines 1-20, use the exact yardline number
    if (loc >= 1 && loc <= 20) {
        return loc.toString();
    }
    // For yardlines 21-99, use the bin ranges
    else if (loc >= 21 && loc <= 23) {
        return '21-23';
    }
    else if (loc >= 24 && loc <= 27) {
        return '24-27';
    }
    else if (loc >= 28 && loc <= 32) {
        return '28-32';
    }
    else if (loc >= 33 && loc <= 38) {
        return '33-38';
    }
    else if (loc >= 39 && loc <= 44) {
        return '39-44';
    }
    else if (loc >= 45 && loc <= 50) {
        return '45-50';
    }
    else if (loc >= 51 && loc <= 70) {
        return '51-70';
    }
    else if (loc >= 71 && loc <= 85) {
        return '71-85';
    }
    else if (loc >= 86 && loc <= 99) {
        return '86-99';
    }
    // Default case for any other values
    else {
        console.warn(`Unexpected yardline value: ${loc}, using default bin`);
        return '45-50'; // Default to midfield as a fallback
    }
}

export async function getChoice(
  year: number,
  coach: string,
  down: number,
  distance: number,
  loc: number
): Promise<number | null> {
  try {
    // Query the coach_decision_probs table using the provided parameters
    const { data, error } = await supabase
      .from('coach_decision_probs')
      .select('run_prob, pass_prob, kick_prob, punt_prob')
      .eq('team', coach)
      .eq('year', year)
      .eq('down', down)
      .eq('distance', Math.min(distance, 20))
      .eq('yardline', loc)
      .eq('is_defense', false)
      .single();
    
    if (error) {
      console.error('Error fetching coach decision probabilities:', error);
      return null;
    }
    
    if (!data) {
      console.warn('No decision probabilities found for the given parameters');
      return null;
    }
    
    // Return just the data object for you to implement the rest of the logic
    return choosePlayType(data);

  } catch (error) {
    console.error('Unexpected error in getChoice:', error);
    return null;
  }
}

export async function getPassVal(
    team: string,
    year: number,
    def_team: string,
    def_year: number,
    down: number,
    distance: number,
    loc: number,
    def_weight: number
    ): Promise<number | null> {
    try {
        // Determine the yardline_bin based on loc
        const yardline_bin = determineYardlineBin(loc);
        
        // Run both queries in parallel
        const [offenseResult, defenseResult] = await Promise.all([
        supabase
            .from('play_cdf')
            .select('values, cdf')
            .eq('team', team)
            .eq('year', year)
            .eq('down', down)
            .eq('distance', Math.min(distance, 20))
            .eq('yardline_bin', yardline_bin)
            .eq('is_defense', false)
            .eq('play_type', 'pass')
            .single(),
        
        supabase
            .from('play_cdf')
            .select('values, cdf')
            .eq('team', def_team)
            .eq('year', def_year)
            .eq('down', down)
            .eq('distance', Math.min(distance, 20))
            .eq('yardline_bin', yardline_bin)
            .eq('is_defense', true)
            .eq('play_type', 'pass')
            .single()
        ]);
        
        // Destructure results
        const { data: offenseData, error: offenseError } = offenseResult;
        const { data: defenseData, error: defenseError } = defenseResult;
        
        // Handle errors
        if (offenseError) {
        console.error('Error fetching offensive passing data:', offenseError);
        return null;
        }
        
        if (defenseError) {
        console.error('Error fetching defensive passing data:', defenseError);
        return null;
        }
        
        if (!offenseData || !defenseData) {
        console.warn('Missing data for passing value calculation');
        return null;
        }
        
        // Extract the values and blend
        const offenseValues = offenseData.values;
        const offenseCdf = offenseData.cdf;
        const defenseValues = defenseData.values;
        const defenseCdf = defenseData.cdf;
        
        return blendDistributions(offenseValues, offenseCdf, defenseValues, defenseCdf, def_weight);

    } catch (error) {
        console.error('Unexpected error in getPassVal:', error);
        return null;
    }
    }

    export async function getRunVal(
    team: string,
    year: number,
    def_team: string,
    def_year: number,
    down: number,
    distance: number,
    loc: number,
    def_weight: number
    ): Promise<number | null> {
    try {
        // Determine the yardline_bin based on loc
        const yardline_bin = determineYardlineBin(loc);
        
        // Run both queries in parallel
        const [offenseResult, defenseResult] = await Promise.all([
        supabase
            .from('play_cdf')
            .select('values, cdf')
            .eq('team', team)
            .eq('year', year)
            .eq('down', down)
            .eq('distance', Math.min(distance, 20))
            .eq('yardline_bin', yardline_bin)
            .eq('is_defense', false)
            .eq('play_type', 'rush')
            .single(),
        
        supabase
            .from('play_cdf')
            .select('values, cdf')
            .eq('team', def_team)
            .eq('year', def_year)
            .eq('down', down)
            .eq('distance', Math.min(distance, 20))
            .eq('yardline_bin', yardline_bin)
            .eq('is_defense', true)
            .eq('play_type', 'rush')
            .single()
        ]);
        
        // Destructure results
        const { data: offenseData, error: offenseError } = offenseResult;
        const { data: defenseData, error: defenseError } = defenseResult;
        
        // Handle errors
        if (offenseError) {
        console.error('Error fetching offensive rushing data:', offenseError);
        return null;
        }
        
        if (defenseError) {
        console.error('Error fetching defensive rushing data:', defenseError);
        return null;
        }
        
        if (!offenseData || !defenseData) {
        console.warn('Missing data for rushing value calculation');
        return null;
        }
        
        // Extract the values and blend
        const offenseValues = offenseData.values;
        const offenseCdf = offenseData.cdf;
        const defenseValues = defenseData.values;
        const defenseCdf = defenseData.cdf;
        
        return blendDistributions(offenseValues, offenseCdf, defenseValues, defenseCdf, def_weight);

    } catch (error) {
        console.error('Unexpected error in getRunVal:', error);
        return null;
    }
}

export async function getPuntVal(loc: number): Promise<number | null> {
  try {
    // Query the punts table using the provided yardline
    const { data, error } = await supabase
      .from('punts')
      .select('data')
      .eq('yardline', loc)
      .single();
    
    if (error) {
      console.error('Error fetching punt data:', error);
      return null;
    }
    
    if (!data) {
      console.warn('No punt data found for the given yardline');
      return null;
    }
    
    // Return the punt data from JSONB column
    const randomIndex = Math.floor(Math.random() * data.data.length);
    return data.data[randomIndex];
    
  } catch (error) {
    console.error('Unexpected error in getPuntVal:', error);
    return null;
  }
}

export async function getKickProb(loc: number): Promise<number | null> {
  try {
    // Query the fg_probs table using the provided yardline
    const { data, error } = await supabase
      .from('fg_probs')
      .select('probability')
      .eq('yardline', loc)
      .single();
    
    if (error) {
      console.error('Error fetching field goal probability:', error);
      return null;
    }
    
    if (!data) {
      console.warn('No field goal probability found for the given yardline');
      return null;
    }
    
    // Return just the probability value
    return data.probability;
    
  } catch (error) {
    console.error('Unexpected error in getKickProb:', error);
    return null;
  }
}