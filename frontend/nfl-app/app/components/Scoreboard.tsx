'use client'

import { teamNames } from "../data/team_names"

type ScoreboardProps = {
  team1: string
  team2: string
  score1: number
  score2: number
  time: number
  down: number
  loc: number
  distance: number
  possession: number
}

export default function Scoreboard({
  team1,
  team2,
  score1,
  score2,
  time,
  down,
  loc,
  distance,
  possession,
}: ScoreboardProps) {

  let downText = `${down} & ${distance}   `;
  if(down == 1){
    downText = `${down}st & ${distance}   `;
  } else if(down == 2){
    downText = `${down}nd & ${distance}   `;
  } else if(down == 3){
    downText = `${down}rd & ${distance}   `;
  } else if(down == 4){
    downText = `${down}th & ${distance}   `;
  }
  else{
    downText = '---'
  }
  
  return (
    <>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '18px',
      }}>
        <span>{teamNames[team1] || team1}</span>
        <span>{teamNames[team2] || team2}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '18px',
      }}>
        <span style={{ color: (score1 > score2 ? 'green' : score1 < score2 ? 'red' : 'black') }}>{score1}</span>
        <span style={{ color: (score2 > score1 ? 'green' : score2 < score1 ? 'red' : 'black') }}>{score2}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '16px',
      }}>
        <span style={{ flex: 1 }}>Possession: {(possession == -1) ? team2 : team1}</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Time: {time}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '16px',
      }}>
        <span style={{ flex: 1 }}>{downText}</span>
        <span style={{ flex: 1, textAlign: 'right'  }}>{(possession == -1 ? (loc > 50 ? team2 : loc < 50 ? team1 : '') : (loc > 50 ? team1 : loc < 50 ? team2 : '')) + (loc > 50 ? ' ' + (100 - loc)
                              : loc < 50 ? ' ' + loc : 'Midfield')}</span>
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: '10px',
        fontSize: '18px',
      }}>
      </div>
    </>
  )
}
