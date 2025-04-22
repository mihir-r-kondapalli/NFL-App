import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
)

// Validate input parameters
function validateParameters(params: any) {
  const { team, year, down, distance } = params
  
  // Check if required parameters are present
  if (!team || !year || !down || (distance === undefined || distance === null)) {
    return 'Missing required parameters'
  }
  
  // Validate team format (should be a 2-3 letter code)
  if (typeof team !== 'string' || team.length < 2 || team.length > 3) {
    return 'Invalid team format'
  }
  
  // Validate year range
  const validYears = [2021, 2022, 2023, 2024]
  if (!validYears.includes(Number(year))) {
    return 'Invalid year. Must be 2021-2024'
  }
  
  // Validate down range
  if (Number(down) < 1 || Number(down) > 4) {
    return 'Invalid down. Must be 1-4'
  }
  
  // Validate distance range
  if (Number(distance) < 1 || Number(distance) > 20) {
    return 'Invalid distance. Must be 1-20'
  }
  
  return null // No validation errors
}

// Helper function to determine the play with highest probability
function getHighestProbabilityPlay(prob: any) {
  const probValues = [
    { type: 1, value: prob.run_prob },
    { type: 2, value: prob.pass_prob },
    { type: 3, value: prob.kick_prob },
    { type: 4, value: prob.punt_prob }
  ];
  
  // Sort by probability (highest first)
  probValues.sort((a, b) => b.value - a.value);
  
  // Return the play type with highest probability
  return probValues[0].type;
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const params = await req.json()
    const { team, year, isDefense, down, distance } = params
    
    // Validate parameters
    const validationError = validateParameters(params)
    if (validationError) {
      return NextResponse.json({ 
        data: null, 
        error: validationError 
      }, { status: 400 })
    }
    
    // Check if Supabase is properly initialized
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Supabase configuration missing');
      return NextResponse.json({ 
        data: null, 
        error: 'Database configuration error' 
      }, { status: 500 })
    }
    
    // Normalize parameters
    const normalizedDistance = down === 1 ? 10 : Math.min(20, Math.max(1, Number(distance)))
    
    // Fetch coach decision probabilities for all yardlines
    const { data: probsData, error: probsError } = await supabase
      .from('coach_decision_probs')
      .select('yardline, run_prob, pass_prob, kick_prob, punt_prob')
      .eq('team', team)
      .eq('year', year)
      .eq('is_defense', isDefense)
      .eq('down', down)
      .eq('distance', normalizedDistance)
      .order('yardline')

    if (probsError) {
      console.error('Error fetching coach decision probabilities:', probsError)
      return NextResponse.json({ 
        data: null, 
        error: 'Failed to fetch coach decision probabilities: ' + probsError.message
      }, { status: 500 })
    }
    
    if (!probsData || probsData.length === 0) {
      return NextResponse.json({ 
        data: [], 
        error: 'No coach decision probability data found for the selected criteria' 
      }, { status: 404 })
    }

    // Fetch optimal play choices from expected_points
    const { data: optData, error: optError } = await supabase
      .from('expected_points')
      .select('yardline, ep, opt_choice')
      .eq('team', team)
      .eq('year', year)
      .eq('is_defense', isDefense)
      .eq('down', down)
      .eq('distance', normalizedDistance)
      .order('yardline')

    // Log some debugging info about the data
    console.log(`Team: ${team}, Year: ${year}, Down: ${down}, Distance: ${normalizedDistance}`);
    console.log(`Probability data count: ${probsData.length}`);
    console.log(`Optimal data count: ${optData?.length || 0}`);
    
    if (optError) {
      console.error('Error fetching optimal play data:', optError)
      // Use highest probability as fallback
      return NextResponse.json({ 
        data: probsData.map(prob => ({
          ...prob,
          opt_choice: getHighestProbabilityPlay(prob),
          ep: null
        })),
        error: 'Failed to fetch optimal play data, using highest probability as optimal: ' + optError.message
      })
    }

    // Merge the data with fallback to highest probability when opt_choice is null
    const mergedData = probsData.map(prob => {
      const optEntry = optData?.find(opt => opt.yardline === prob.yardline)
      
      // If optEntry exists but opt_choice is null, or if optEntry doesn't exist,
      // use the play with highest probability as the optimal choice
      const optChoice = (optEntry && optEntry.opt_choice) 
        ? optEntry.opt_choice + 1
        : getHighestProbabilityPlay(prob);
      
      return {
        ...prob,
        opt_choice: optChoice,
        ep: optEntry?.ep || null
      }
    })

    // Log counts of null/non-null optimal choices
    const nullOptCount = mergedData.filter(item => !item.opt_choice).length;
    console.log(`Items with null opt_choice after merging: ${nullOptCount}`);
    if (nullOptCount > 0) {
      console.log(`First few null opt_choice yardlines:`, 
        mergedData.filter(item => !item.opt_choice)
          .slice(0, 5)
          .map(item => item.yardline)
      );
    }

    // Validate probabilities sum to 1 (or close to it due to floating point)
    const validatedData = mergedData.map(item => {
      const sum = item.run_prob + item.pass_prob + item.kick_prob + item.punt_prob
      // If sum is significantly different from 1, normalize the probabilities
      if (Math.abs(sum - 1) > 0.01) {
        return {
          ...item,
          run_prob: item.run_prob / sum,
          pass_prob: item.pass_prob / sum,
          kick_prob: item.kick_prob / sum,
          punt_prob: item.punt_prob / sum
        }
      }
      return item
    })

    return NextResponse.json({ data: validatedData, error: null })
    
  } catch (error: any) {
    console.error('Unexpected error processing request:', error)
    return NextResponse.json({ 
      data: null, 
      error: 'Internal server error: ' + (error?.message || 'Unknown error')
    }, { status: 500 })
  }
}