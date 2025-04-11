'use client'

type FieldProps = {
  score1: number
  score2: number
  loc: number            // Ball position (0–100)
  target: number         // First down marker (0–100)
  down: number
  time: string
  ep1: number
  ep2: number
  possessionIndicator: number  // -1 = Team 1, 1 = Team 2
  no_disp: number
}

export default function Field({
  score1,
  score2,
  loc,
  target,
  down,
  time,
  ep1,
  ep2,
  possessionIndicator,
  no_disp,
}: FieldProps) {
  return (
    <div style={{ width: "100%", textAlign: "center", marginTop: "20px" }}>
      <div
        style={{
          width: "80%",
          height: "200px",
          border: "2px solid black",
          margin: "auto",
          position: "relative",
          background: "green",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left End Zone */}
        <div
          style={{
            width: "10%",
            height: "100%",
            background: "red",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
          }}
        >
          T1
        </div>

        {/* Field Center */}
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((yard, index) => (
            <div
              key={`yard-${yard}-${index}`}
              style={{
                position: "absolute",
                left: `${(index + 1) * 10}%`,
                top: "0",
                height: "100%",
                width: "2px",
                background: "white",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "-8px",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                {yard}
              </span>
            </div>
          ))}

          {Array.from({ length: 99 }, (_, i) => i + 1).map((yard) => (
            <div
              key={`tick-${yard}`}
              style={{
                position: "absolute",
                left: `${yard}%`,
                top: "0",
                height: yard % 5 === 0 ? "10%" : "5%",
                width: "1px",
                background: "white",
                opacity: yard % 5 === 0 ? 0.7 : 0.4,
              }}
            />
          ))}

          {Array.from({ length: 99 }, (_, i) => i + 1).map((yard) => (
            <div
              key={`tick-bottom-${yard}`}
              style={{
                position: "absolute",
                left: `${yard}%`,
                bottom: "0",
                height: yard % 5 === 0 ? "10%" : "5%",
                width: "1px",
                background: "white",
                opacity: yard % 5 === 0 ? 0.7 : 0.4,
              }}
            />
          ))}

          {/* Markers (only shown if no_disp === 0) */}
          {no_disp === 0 && (
            <>
              {/* Line of Scrimmage */}
              <div
                style={{
                  position: "absolute",
                  left: `${loc}%`,
                  top: "0",
                  height: "100%",
                  width: "2px",
                  background: "blue",
                }}
              />

              {/* First Down Line */}
              <div
                style={{
                  position: "absolute",
                  left: `${target}%`,
                  top: "0",
                  height: "100%",
                  width: "2px",
                  background: "yellow",
                }}
              />

              {/* Ball Marker (Triangle) */}
              <div
                style={{
                  position: "absolute",
                  left:
                    possessionIndicator === -1
                      ? `calc(${Number(loc)}% + 0.5%)`
                      : `calc(${Number(loc)}% - 0.5%)`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "0",
                  height: "0",
                  borderLeft:
                    possessionIndicator === -1
                      ? "10px solid brown"
                      : "10px solid transparent",
                  borderRight:
                    possessionIndicator === 1
                      ? "10px solid brown"
                      : "10px solid transparent",
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                }}
              />
            </>
          )}
        </div>

        {/* Right End Zone */}
        <div
          style={{
            width: "10%",
            height: "100%",
            background: "red",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
          }}
        >
          T2
        </div>
      </div>
    </div>
  )
}
