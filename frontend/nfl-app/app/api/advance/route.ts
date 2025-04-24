import { NextRequest, NextResponse } from 'next/server'
import { getChoice, getPassVal, getRunVal, getPuntVal, getKickProb } from './api_functions'

type GameState = {
  score1: number
  score2: number
  team1: string
  team2: string
  year1: number
  year2: number
  coach1: string
  coach2: string
  time: number
  down: number
  distance: number
  loc: number
  target: number
  possession: -1 | 1
  drive: boolean
  message: string
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL as string) || 'http://localhost:8000';

type PlayChoice = -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4

export async function POST(req: NextRequest) {
  const { state, choice }: { state: GameState; choice: PlayChoice } = await req.json()

  // Run your game logic server-side
  const newState = await advanceGameState(state, choice)

  return NextResponse.json(newState)
}

// Fixed function that correctly handles the AI prediction request
async function getPrediction(down: number, distance: number, loc: number, time: number, score_diff: number): Promise<number> {
  try {
    console.log('Sending strategy prediction request:', { down, distance, loc, time, score_diff })
    
    // Make request to your strategy prediction API
    const response = await fetch(API_URL+'/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        down,
        distance,
        loc,
        time,
        score_diff
      }),
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      console.error('Non-JSON response received:', text)
      return 1 // Default to run play if we can't get a prediction
    }
    
    if (!response.ok) {
      const error = await response.json()
      console.error('API error:', error)
      return 1 // Default to run play if we can't get a prediction
    }
    
    const result = await response.json()
    console.log('Received prediction from backend:', result)
    
    return result.action
  } catch (error) {
    console.error('Error processing strategy prediction request:', error)
    return 1 // Default to run play if we can't get a prediction
  }
}

// Return number refers to button status of game: -1 -> Continue Button, 0 -> Misc, 1 -> Normal (4 buttons), 2 -> Xp / 2 pt
async function advanceGameState(state: GameState, choice_val: PlayChoice): Promise<[GameState, number]> {
  const newState = { ...state }
  let result = ''
  let fnum = 0
  let choice = Number(choice_val)

  let coach = (newState.possession == -1 ? newState.coach2 : newState.coach1)

  if(choice_val == -1 && newState.drive){
    let year = (newState.possession == -1 ? newState.year2 : newState.year1) 
    if(coach != 'Human' && coach != 'AI'){
      choice = Number(await getChoice(year, coach, newState.down, newState.distance, newState.loc))
    }
    else if(coach == 'AI'){
      // Call the fixed prediction function
      choice = await getPrediction(
        newState.down,
        newState.distance,
        newState.loc,
        newState.time,
        newState.possession === 1 
          ? newState.score1 - newState.score2 
          : newState.score2 - newState.score1
      );
    }
  }

  if (choice === -2) {
    if(Math.random() <= 0.945){
      newState.message = `XP Made!`
      if (newState.possession == -1){
        newState.score2 += 1
      }
      else{
        newState.score1 += 1
      }
    }
    else{
      newState.message = `XP Missed!`
    }
    newState.possession *= -1
    if (newState.time <= 0){
      return [newState, 0]
    }
    return [newState, -1]
  } else if(choice === -3){
    if(Math.random() <= 0.45){
      newState.message = `2PT Conversion Successful!`
      if (newState.possession == -1){
        newState.score2 += 2
      }
      else{
        newState.score1 += 2
      }
    }
    else{
      newState.message = `2PT Conversion Failed!`
    }
    newState.possession *= -1
    if (newState.time <= 0){
      return [newState, 0]
    }
    return [newState, -1]
  }

  if (!newState.drive) {
    newState.drive = true
    newState.loc = Math.floor(Math.random() * -10) + 76
    newState.target = newState.loc - 10
    newState.down = 1
    newState.message = `Kickoff received at ${newState.loc}.`
    newState.distance = 10
    fnum = 1
  }

  // SAFETY check
  if (newState.loc >= 100) {
    if (newState.possession === -1) {
      newState.score1 += 2
    } else {
      newState.score2 += 2
    }
    newState.drive = false
    newState.message = 'SAFETY!'
    newState.possession *= -1
    fnum = -1
  }

  if (choice === 1 || choice === 2) {
    const gainPromise = choice === 1 ? (newState.possession == 1 ? getRunVal(newState.team1, newState.year1, newState.team2, newState.year2, newState.down, newState.distance, newState.loc, 0.3)
                                : getRunVal(newState.team2, newState.year2, newState.team1, newState.year1, newState.down, newState.distance, newState.loc, 0.3))
                                : (newState.possession == 1 ? getPassVal(newState.team1, newState.year1, newState.team2, newState.year2, newState.down, newState.distance, newState.loc, 0.3)
                                : getPassVal(newState.team2, newState.year2, newState.team1, newState.year1, newState.down, newState.distance, newState.loc, 0.3))
    
    const gain = Math.min(Number(await gainPromise), newState.loc)
    result = (choice === 1 ? "Run " : "Pass ") + `for ${gain} yards.`

    if (gain < -2000){
      newState.loc = 100 - (newState.loc - (gain + 2100))
      if(newState.loc >= 100){
        if (newState.possession === 1) {
          newState.score2 += 6
        } else {
          newState.score1 += 6
        }
        newState.message = "PASS INTERCEPTED! Returned for a TOUCHDOWN!"
        newState.possession *= -1
        newState.drive = false
        fnum = 2
      }
      else if(newState.loc <= 0){
        newState.loc = 80
        newState.message = "PASS INTERCEPTED! TOUCHBACK!"
        newState.drive = false
        newState.possession *= -1
        fnum = 2
      }
      else{
        newState.message = `PASS INTERCEPTED! Returned for ${gain + 2100} yards!`
        fnum = 1
        newState.possession *= -1
      }
      newState.target = Math.max(newState.loc - 10, 0)
      newState.down = 1
    }
    else if (gain < -1000){
      newState.loc = 100 - (newState.loc - (gain + 1100))
      if(newState.loc >= 100){
        if (newState.possession === 1) {
          newState.score2 += 6
        } else {
          newState.score1 += 6
        }
        newState.message = "Fumble! Returned for a TOUCHDOWN!"
        newState.possession *= -1
        newState.drive = false
        fnum = 2
      }
      else if(newState.loc <= 0){
        newState.message = "Fumble! TOUCHBACK!"
        newState.drive = false
        fnum = 2
        newState.possession *= -1
      }
      else{
        newState.message = `Fumble! Returned for ${gain + 1100} yards!`
        fnum = 1
        newState.possession *= -1
      }
      newState.target = Math.max(newState.loc - 10, 0)
      newState.down = 1
    }
    else if (newState.loc-gain <= 0) {
      newState.loc -= gain
      // Touchdown on the play
      if (newState.possession === -1) {
        newState.score2 += 6
      } else {
        newState.score1 += 6
      }
      newState.message = result + " TOUCHDOWN!"
      newState.drive = false
      fnum = 2
    }
    else {
      newState.loc -= gain
      newState.down += 1

      if (choice == 2){
        if (gain == 0){
          result = 'Pass incomplete.'
        }
        else if(gain < -3){
          result = `Sacked for ${gain} yards.`
        }
      }

      if (newState.loc <= newState.target) {
        // First down
        newState.down = 1
        newState.target = Math.max(newState.loc - 10, 0)
        newState.message = `${result} First down!`
        fnum = 1
      }
      else if (newState.down > 4) {
        // Turnover on downs
        newState.possession *= -1
        newState.down = 1
        newState.loc = 100 - newState.loc
        newState.target = Math.max(newState.loc - 10, 0)
        newState.message = `${result} Turnover on downs.`
        fnum = 1
      } else {
        newState.message = `${result}`
        fnum = 1
      }
    }
  } else if (choice === 3) {
    if(newState.loc > 50){
      newState.message = `Can't kick a field goal from this far!`
      return [newState, 1]
    }
    newState.possession *= -1
    if (newState.loc <= 35) {
      newState.message = 'Field goal is GOOD!'
      if (newState.possession === -1) {
        newState.score1 += 3
      } else {
        newState.score2 += 3
      }
      newState.drive = false
      fnum = -1
    } else {
      newState.message = 'Field goal MISSED!'
      newState.loc = 100 - (newState.loc + 7)
      newState.target = Math.max(newState.loc-10, 0)
      newState.down = 1
      fnum = 1
    }
  } else if (choice === 4) {
    const punt = Number(await getPuntVal(newState.loc))
    if(punt > 1000){ // muffed punt
      newState.message = `Punt MUFFED!`
      fnum = 1
      newState.loc -= punt-1100
      if (newState.loc <= 0) {
        if (newState.possession === -1) {
          newState.score2 += 6
        } else {
          newState.score1 += 6
        }
        newState.message = result + " TOUCHDOWN!"
        newState.drive = false
        fnum = 2
      }
      newState.down = 1
      newState.target = Math.max(newState.loc - 10, 0)
    }
    else if(punt < -1000){
      newState.message = 'Punt returned for a TOUCHDOWN!'
      if (newState.possession === 1) {
        newState.score2 += 6
      } else {
        newState.score1 += 6
      }
      newState.message = result + " TOUCHDOWN!"
      newState.drive = false
      newState.possession *= -1
      fnum = 2
    }
    else{
      newState.message = `Punt for ${punt} yards.`
      newState.loc -= punt
      if(newState.loc <= 0){
        newState.message = `Punt for ${punt} yards. TOUCHBACK`
        newState.loc = 20
      }
      newState.down = 1
      newState.loc = 100 - newState.loc
      newState.target = Math.max(newState.loc - 10, 0)
      newState.possession *= -1
      fnum = 1
    }
  }

  newState.time = Math.max(0, newState.time - 1)

  newState.distance = Math.abs(newState.loc - newState.target)

  if (newState.time <= 0){
    return [newState, -10]
  }
  
  const bot_play = (newState.coach1 != 'Human' && newState.possession == 1) || (newState.coach2 != 'Human' && newState.possession == -1)

  if(coach != 'Human' && fnum == 2){
    let scoreDiff = newState.possession == 1 ? newState.score1 - newState.score2 : newState.score2 - newState.score1
    
    if (newState.time <= 30 && (scoreDiff == 5 || scoreDiff == 1 || scoreDiff == -5 || scoreDiff == -9 || scoreDiff == -18)){
      if(Math.random() <= 0.45){
        result += ' 2PT conversion successful!'
        if (newState.possession == -1){
          newState.score2 += 1
        }
        else{
          newState.score1 += 1
        }
      }
      else{
        result += ' 2PT conversion failed!'
      }
    }
    else{
      if(Math.random() <= 0.945){
        result += ' XP is good!'
        if (newState.possession == -1){
          newState.score2 += 1
        }
        else{
          newState.score1 += 1
        }
      }
      else{
        result += ' XP missed!'
      }
    }
    newState.possession *= -1
  }

  return [newState, (coach == 'Human' || !bot_play) ? fnum : -1]
}