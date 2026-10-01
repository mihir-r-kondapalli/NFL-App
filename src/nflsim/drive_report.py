"""Capture drive events without changing the engine's state or random draws."""

from .clock import display_clock


class DriveReport:
    def __init__(self):
        self.drives = []
        self.current = None

    def observe(self, before, after):
        scored = (before.score1, before.score2) != (after.score1, after.score2)
        if self.current is None:
            if not (before.drive or after.drive or scored):
                return
            start = before if before.drive or scored else after
            self.current = dict(
                number=len(self.drives) + 1,
                team=start.team1 if start.possession == 1 else start.team2,
                possession=start.possession,
                start=display_clock(start),
                start_yards_to_goal=start.loc,
                plays=0,
                events=[],
            )
        if not before.pending_xp:
            # All positions stay relative to the team that began this drive,
            # even after the engine flips possession and its yardline coordinate.
            origin = self.current["possession"]
            end = after.loc if after.possession == origin else 100 - after.loc
            message = after.message
            outcome = "Drive ended"
            if "Field goal" in message:
                end = before.loc
                outcome = "FG made" if "GOOD" in message else "FG missed"
            elif "SAFETY" in message:
                end, outcome = 100, "Safety"
            elif "TOUCHDOWN" in message:
                end = 0 if after.possession == origin else 100
                outcome = "TD" if after.possession == origin else "Return TD"
                if "Punt returned" in message:
                    self.current["kick_end_yards_to_goal"] = end
                    end, outcome = before.loc, "Punt return TD"
            elif "Punt" in message:
                end, outcome = before.loc, "Punt"
                self.current["kick_end_yards_to_goal"] = max(
                    0, min(100, after.loc if after.possession == origin else 100 - after.loc)
                )
                if "muffed" in message.lower():
                    outcome = "Muffed punt"
            elif "Interception" in message:
                outcome = "Interception"
            elif "Fumble" in message:
                outcome = "Fumble"
            elif "Turnover on downs" in message:
                outcome = "Turnover on downs"
            elif "Halftime" in message or after.finished or after.time == 0:
                outcome = "End of half" if "Halftime" in message else "End of game"
                if "Halftime" in message:
                    end = after.loc
                if after.plays_elapsed == before.plays_elapsed:
                    end = before.loc
            self.current["end_yards_to_goal"] = max(0, min(100, end))
            self.current["result"] = outcome
        self.current["plays"] += after.plays_elapsed - before.plays_elapsed
        self.current["events"].append(
            dict(
                clock=display_clock(after),
                message=after.message,
                home_score=after.score1,
                away_score=after.score2,
            )
        )
        self.current.update(
            end=display_clock(after),
            home_score=after.score1,
            away_score=after.score2,
            outcome=(self.current.get("outcome", "") + " " + after.message).strip()
            if before.pending_xp
            else after.message,
        )
        if not after.pending_xp and (
            not after.drive
            or after.finished
            or after.time == 0
            or after.possession != self.current["possession"]
        ):
            self.finish()

    def finish(self):
        if self.current is not None:
            self.current.pop("possession")
            self.drives.append(self.current)
            self.current = None
        return self.drives
