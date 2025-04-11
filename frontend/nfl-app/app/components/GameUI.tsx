'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Scoreboard from './Scoreboard'
import Field from './Field'
import GameTopBar from './GameTopBar'
import TopBar from './TopBar'

export default function GameUI() {
  const router = useRouter()

  const [score1, setScore1] = useState(14)
  const [score2, setScore2] = useState(10)
  const [time, setTime] = useState("2:35 Q4")
  const [down, setDown] = useState(3)
  const [distance, setDistance] = useState(6)
  const [loc, setLoc] = useState(35)
  const [target, setTarget] = useState(41)
  const [possession, setPossession] = useState(-1)
  const [ep1, setEp1] = useState(2.3)
  const [ep2, setEp2] = useState(-2.3)
  const [message, setMessage] = useState("Welcome to the football simulator.")
  const [no_disp, setNoDisp] = useState(0)

  const playGame = (type: number) => {
    setMessage(`You selected play type ${type}.`);
  }

  const handleXP = (choice: number) => {
    setMessage(`XP Choice: ${choice === 1 ? "Kick XP" : "Go for 2PT"}`);
  }

  const endGame = () => {
    setMessage("Game ended. Final score: " + score1 + " - " + score2);
  }

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
      <GameTopBar />
      <div style={{marginTop: '10px', marginBottom: '10px',}}>
        <h1>Football Simulator</h1>
      </div>

      <Scoreboard
        score1={score1}
        score2={score2}
        time={time}
        down={down}
        distance={distance}
        possession={possession}
      />

      <Field
        score1={score1}
        score2={score2}
        loc={loc}
        target={target}
        down={down}
        time={time}
        ep1={ep1}
        ep2={ep2}
        possessionIndicator={possession}
        no_disp={no_disp}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        marginTop: '20px',
        flexWrap: 'wrap'
      }}>
        <button onClick={() => playGame(1)}>Run</button>
        <button onClick={() => playGame(2)}>Pass</button>
        <button onClick={() => playGame(3)}>Field Goal</button>
        <button onClick={() => playGame(4)}>Punt</button>
        <button onClick={() => handleXP(1)}>XP</button>
        <button onClick={() => handleXP(2)}>2PT</button>
        <button onClick={endGame}>End Game</button>
      </div>

      <div style={{
        width: '80%',
        marginTop: '20px',
        backgroundColor: '#003300',
        padding: '10px',
        border: '1px solid #666',
        borderRadius: '8px',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
      }}>
        {message}
      </div>

    </div>
  )
}
