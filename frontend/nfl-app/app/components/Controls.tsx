// app/components/Controls.tsx
"use client"

type ControlsProps = {
  expectation: number
  playGame: (choice: number) => void
  startGame: () => void
  endGame: () => void
  handleXP: (value: number) => void
  handleToggle: () => void
  message: "string"
}

export default function Controls({
  expectation,
  playGame,
  startGame,
  endGame,
  handleXP,
  handleToggle,
  message,
}: ControlsProps) {
  const buttonStyle = {
    margin: "5px",
    padding: "10px 20px",
    fontSize: "16px",
  }

  return (
    <>
      {expectation === 0 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={() => playGame(0)} style={buttonStyle}>Continue</button>
          <p style={{ marginTop: "20px", fontSize: "18px", whiteSpace: "pre-line" }}>{message}</p>
        </div>
      )}
      {expectation === 1 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={() => playGame(1)} style={buttonStyle}>Run</button>
          <button onClick={() => playGame(2)} style={buttonStyle}>Pass</button>
          <button onClick={() => playGame(3)} style={buttonStyle}>Field Goal</button>
          <button onClick={() => playGame(4)} style={buttonStyle}>Punt</button>
          <p style={{ marginTop: "20px", fontSize: "18px", whiteSpace: "pre-line" }}>{message}</p>
        </div>
      )}
      {expectation === 2 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={() => handleXP(1)} style={buttonStyle}>XP Try</button>
          <button onClick={() => handleXP(2)} style={buttonStyle}>2PT Try</button>
          <p style={{ marginTop: "20px", fontSize: "18px", whiteSpace: "pre-line" }}>{message}</p>
        </div>
      )}
      {expectation === 3 && (
        <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <button onClick={startGame} style={buttonStyle}>Play Again</button>
          <div style={{
            width: "80%",
            minHeight: "50px",
            maxHeight: "100px",
            overflowY: "auto",
            border: "1px solid black",
            padding: "10px",
            textAlign: "left",
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
            display: "block"
          }}>
            <div style={{ width: "100%" }}>
              {typeof message === "string" ? <span>{message}</span> : message}
            </div>
          </div>
        </div>
      )}
      {expectation === 4 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={startGame} style={buttonStyle}>Start Game</button>
          <p style={{ marginTop: "20px", fontSize: "18px" }}>{message}</p>
        </div>
      )}
      {expectation <= 2 && (
        <div style={{ marginTop: "20px" }}>
          <button onClick={handleToggle} style={buttonStyle}>Toggle EP</button>
          <button onClick={endGame} style={buttonStyle}>End Game</button>
        </div>
      )}
    </>
  )
}
