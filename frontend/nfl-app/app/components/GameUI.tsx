'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Scoreboard from './Scoreboard'
import Field from './Field'
import GameTopBar from './GameTopBar'
import TopBar from './TopBar'

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

export default function GameUI() {
  const router = useRouter()

  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [time, setTime] = useState(130)
  const [down, setDown] = useState(0)
  const [distance, setDistance] = useState(-1)
  const [loc, setLoc] = useState(50)
  const [year1, setYear1] = useState(2024)
  const [year2, setYear2] = useState(2024)
  const [coach1, setCoach1] = useState('Human')
  const [coach2, setCoach2] = useState('KC')
  const [target, setTarget] = useState(50)
  const [possession, setPossession] = useState(1)
  const [drive, setDrive] = useState(false)
  const [ep1, setEp1] = useState(0)
  const [ep2, setEp2] = useState(0)
  const [message, setMessage] = useState("Welcome to the football simulator.")
  const [no_disp, setNoDisp] = useState(0)
  const [num_state, setNumState] = useState(0)

  const resetGameState = () => {
    setScore1(0);
    setScore2(0);
    setTime(130);
    setDown(0);
    setDistance(-1);
    setLoc(50);
    setTarget(50);
    setPossession(1);
    setDrive(false);
    setEp1(0);
    setEp2(0);
    setMessage("Welcome to the football simulator.");
    setNoDisp(0);
    setNumState(0);
  };

  const handleXP = (choice: number) => {
    setMessage(`XP Choice: ${choice === 1 ? "Kick XP" : "Go for 2PT"}`);
  }

  const endGame = () => {
    setMessage("Game ended. Final score: " + score1 + " - " + score2);
  }

  const buttonStyle = {
    backgroundColor: '#004400',
    color: 'white',
    border: '1px solid #00AA00',
    borderRadius: '4px',
    padding: '8px 16px',
    margin: '5px',
    fontFamily: 'monospace',
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.2s ease'
  };

  const continueButtonStyle = {
    ...buttonStyle,
    padding: '10px 20px',
    fontSize: '18px',
    backgroundColor: '#005500'
  };

  const [team1, setTeam1] = useState('PHI')
  const [team2, setTeam2] = useState('KC')

  const playGame = async (choice: number) => {
    const gameState: GameState = {
      score1,
      score2,
      team1,
      team2,
      year1,
      year2,
      coach1,
      coach2,
      time,
      down,
      distance,
      loc,
      target,
      possession: possession as 1 | -1,
      drive,
      message
    }
  
    const res = await fetch('/api/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: gameState, choice }),
    })
  
    const response: [GameState, number] = await res.json();
    const [newState, num_state] = response;

    console.log(num_state)
  
    // Update individual states
    setScore1(newState.score1)
    setScore2(newState.score2)
    setTime(newState.time)
    setDown(newState.down)
    setDistance(newState.distance)
    setLoc(newState.loc)
    setTarget(newState.target)
    setPossession(newState.possession)
    setDrive(newState.drive)
    setMessage((newState.time > 0) ? newState.message : newState.message + ` GAME OVER!`)
    setNumState(num_state)
    // setDrive(newState.drive)
  }

  const bot_play = (coach1 != 'Human' && possession == 1) || (coach2 != 'Human' && possession == -1)

  return (

    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'monospace',
      color: '007000',
      minHeight: '100vh',
    }}>
    
      <TopBar />
      <GameTopBar team1={team1} team2={team2} year1={year1} year2={year2} coach1={coach1} coach2={coach2} numState={num_state} setTeam1={setTeam1} setTeam2={setTeam2} setNumState={setNumState}
                  resetGame={resetGameState} setYear1={setYear1} setYear2={setYear2} setCoach1={setCoach1} setCoach2={setCoach2}/>
      <div style={{marginTop: '10px', marginBottom: '10px',}}>
        <h1></h1>
      </div>

      <Scoreboard
        team1={team1 == team2 ? team1 + '1' : team1}
        team2={team1 == team2 ? team1 + '2' : team2}
        score1={score1}
        score2={score2}
        time={time}
        down={(num_state == 1 || bot_play) ? down : -1}
        loc={loc}
        distance={Math.abs(loc-target)}
        possession={possession}
      />

      <Field
        team1={team1}
        team2={team2}
        score1={score1}
        score2={score2}
        loc={loc}
        target={target}
        down={down}
        time={time}
        ep1={ep1}
        ep2={ep2}
        possessionIndicator={possession}
        no_disp={!drive}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '20px',
        flexWrap: 'wrap'
      }}>
        {num_state === 0 && (
          <>
            <button
              onClick={() => playGame(0)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Play
            </button>
          </>
        )}

        {(num_state === -1 && !bot_play) && (
          <button 
            onClick={() => playGame(-1)} 
            style={continueButtonStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#006600'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005500'}
          >
            Continue
          </button>
        )}

        {((num_state === -1 || num_state === 1) && bot_play) && (
          <button 
            onClick={() => playGame(-1)} 
            style={continueButtonStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#006600'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005500'}
          >
            Continue
          </button>
        )}

        {num_state === 1 && !bot_play && (
          <>
            <button 
              onClick={() => playGame(1)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Run
            </button>
            <button 
              onClick={() => playGame(2)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Pass
            </button>
            <button 
              onClick={() => playGame(3)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Field Goal
            </button>
            <button 
              onClick={() => playGame(4)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Punt
            </button>
          </>
        )}

        {num_state === 2 && !bot_play && (
          <>
            <button 
              onClick={() => playGame(-2)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              XP
            </button>
            <button 
              onClick={() => playGame(-3)} 
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              2PT
            </button>
          </>
        )}
      </div>

      <div style={{
        width: '80%',
        maxHeight: num_state === -10 ? '400px' : 'auto', // Make it scrollable when showing drive log
        overflowY: num_state === -10 ? 'auto' : 'hidden',
        marginTop: '20px',
        backgroundColor: '#003300',
        padding: '10px',
        border: '1px solid #666',
        borderRadius: '8px',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
        color: 'white',
        lineHeight: '1.5'
      }}>
        {message}
      </div>

    </div>
  )
}
