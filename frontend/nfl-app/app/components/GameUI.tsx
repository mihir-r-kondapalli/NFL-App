'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Scoreboard from './Scoreboard'
import Field from './Field'
import GameTopBar from './GameTopBar'
import TopBar from './TopBar'
import { useDataset, DatasetStatus } from './DatasetProvider'

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
  pending_xp: boolean
  timing_mode: "clock"
  period: number
  opening_receiver: -1 | 1 | null
  clock_running: boolean
  timeouts1: number
  timeouts2: number
  ot_completed: number
  finished: boolean
  plays_elapsed: number
  safety_kick: boolean
}

export default function GameUI() {
  const router = useRouter()

  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const initialClock = { timing_mode: 'clock' as const, period: 1, opening_receiver: null as -1 | 1 | null,
    clock_running: false, timeouts1: 3, timeouts2: 3, ot_completed: 0, finished: false,
    plays_elapsed: 0, safety_kick: false };
  const [clock, setClock] = useState(initialClock)
  const [time, setTime] = useState(3600)
  const [down, setDown] = useState(0)
  const [distance, setDistance] = useState(-1)
  const [loc, setLoc] = useState(50)
  const [year1, setYear1] = useState(0)
  const [year2, setYear2] = useState(0)
  const [coach1, setCoach1] = useState('Human')
  const [coach2, setCoach2] = useState('KC')
  const [target, setTarget] = useState(50)
  const [possession, setPossession] = useState(Math.floor(Math.random()*2) == 0 ? -1 : 1)
  const [drive, setDrive] = useState(false)
  const [pendingXP, setPendingXP] = useState(false)
  const [busy, setBusy] = useState(false)
  const dataset = useDataset()
  const [ep1, setEp1] = useState(0)
  const [ep2, setEp2] = useState(0)
  const [message, setMessage] = useState("Welcome to the football simulator.")
  const [no_disp, setNoDisp] = useState(0)
  const [num_state, setNumState] = useState(0)

  const resetGameState = () => {
    setScore1(0);
    setScore2(0);
    setTime(3600);
    setClock(initialClock);
    setDown(0);
    setDistance(-1);
    setLoc(50);
    setTarget(50);
    setPossession(Math.floor(Math.random()*2) == 0 ? -1 : 1);
    setDrive(false);
    setPendingXP(false);
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
    setTime(0);
    setDrive(false);
    setPendingXP(false);
    setNumState(-10);
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

  useEffect(() => {
    setTeam1(dataset.teamsFor(year1)[0] || '');
  }, [year1, dataset.seasons]);
  useEffect(() => {
    const available = dataset.teamsFor(year2);
    setTeam2(available[0] || '');
    setCoach2(available[0] || 'Human');
  }, [year2, dataset.seasons]);

  const playGame = async (choice: number) => {
    if (busy) return;
    if (!year1 || !year2 || !team1 || !team2) {
      setMessage('Select a season and team for each side.');
      return;
    }
    setBusy(true);
    try {
    const gameState: GameState = {
      ...clock,
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
      message,
      pending_xp: pendingXP
    }

    const res = await fetch('/api/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: gameState, choice }),
    })

    const response = await res.json();
    if (!res.ok) throw new Error(typeof response.detail === 'string' ? response.detail : 'Could not advance the game.');
    const [newState, num_state] = response as [GameState, number];
    setPendingXP(newState.pending_xp);
    setClock({ timing_mode: 'clock', period: newState.period, opening_receiver: newState.opening_receiver,
      clock_running: newState.clock_running, timeouts1: newState.timeouts1, timeouts2: newState.timeouts2,
      ot_completed: newState.ot_completed, finished: newState.finished,
      plays_elapsed: newState.plays_elapsed, safety_kick: newState.safety_kick });

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
    setMessage((newState.time > 0 || newState.pending_xp) ? newState.message : newState.message + ` GAME OVER!`)
    setNumState(num_state)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not advance the game.');
    } finally {
      setBusy(false);
    }
  }

  if (dataset.loading || dataset.error || !dataset.seasons.length) return <><TopBar /><DatasetStatus /></>

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
                  busy={busy} endGame={endGame} resetGame={resetGameState} setYear1={setYear1} setYear2={setYear2} setCoach1={setCoach1} setCoach2={setCoach2}/>
      <div style={{marginTop: '10px', marginBottom: '10px',}}>
        <h1></h1>
      </div>

      <Scoreboard
        team1={team1 == team2 ? team1 + '1' : team1}
        team2={team1 == team2 ? team1 + '2' : team2}
        score1={score1}
        score2={score2}
        time={time}
        clockLabel={`${clock.period === 5 ? 'OT' : 'Q' + clock.period} ${Math.floor(Math.max(0, time - (clock.period === 5 ? 0 : (4 - clock.period) * 900)) / 60)}:${String(Math.max(0, time - (clock.period === 5 ? 0 : (4 - clock.period) * 900)) % 60).padStart(2, '0')}`}
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
        {num_state === 0 && time > 0 && (
          <>
            <button
              disabled={busy} onClick={() => playGame(0)}
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
            disabled={busy} onClick={() => playGame(-1)}
            style={continueButtonStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#006600'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005500'}
          >
            Continue
          </button>
        )}

        {((num_state === -1 || num_state === 1) && bot_play) && (
          <button
            disabled={busy} onClick={() => playGame(-1)}
            style={continueButtonStyle}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#006600'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#005500'}
          >
            Continue
          </button>
        )}

        <p>Timeouts: {team1} {clock.timeouts1} · {team2} {clock.timeouts2}</p>
        {num_state === 1 && !bot_play && (
          <>
            <button
              disabled={busy} onClick={() => playGame(1)}
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Run
            </button>
            <button
              disabled={busy} onClick={() => playGame(2)}
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Pass
            </button>
            <button
              disabled={busy} onClick={() => playGame(3)}
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Field Goal
            </button>
            <button
              disabled={busy} onClick={() => playGame(4)}
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              Punt
            </button>
            <button disabled={busy || (possession === 1 ? clock.timeouts1 : clock.timeouts2) === 0}
              onClick={() => playGame(5)} style={buttonStyle}>Timeout</button>
            <button disabled={busy} onClick={() => playGame(6)} style={buttonStyle}>Kneel</button>
          </>
        )}

        {num_state === 2 && !bot_play && (
          <>
            <button
              disabled={busy} onClick={() => playGame(-2)}
              style={buttonStyle}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#005500'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#004400'}
            >
              XP
            </button>
            <button
              disabled={busy} onClick={() => playGame(-3)}
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
