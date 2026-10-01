from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator
from .config import normalize_team


class DataQuery(BaseModel):
    team: str
    year: int = Field(ge=1999, le=2100)
    isDefense: bool = False
    down: int = Field(ge=1, le=4)
    distance: int = Field(ge=1, le=100)


class SimulationRequest(BaseModel):
    team1: str
    team2: str
    year1: int = Field(ge=1999, le=2100)
    year2: int = Field(ge=1999, le=2100)
    num_games: int = Field(default=1, ge=1, le=1000)
    num_plays: int = Field(default=150, ge=1, le=500)
    seed: int = 25
    timing_mode: Literal["clock", "plays"] = "clock"
    include_drives: bool = False
    postseason: bool = False

    @model_validator(mode="after")
    def valid_postseason(self):
        if self.postseason and self.timing_mode != "clock":
            raise ValueError("Postseason requires clock mode")
        return self


class GameState(BaseModel):
    score1: int = Field(default=0, ge=0)
    score2: int = Field(default=0, ge=0)
    team1: str
    team2: str
    year1: int = Field(ge=1999, le=2100)
    year2: int = Field(ge=1999, le=2100)
    coach1: str = "Human"
    coach2: str = "Human"
    time: int = Field(default=150, ge=0, le=3600)
    timing_mode: Literal["clock", "plays"] = "plays"
    period: int = Field(default=1, ge=1, le=5)
    opening_receiver: Optional[Literal[-1, 1]] = None
    clock_running: bool = False
    timeouts1: int = Field(default=3, ge=0, le=3)
    timeouts2: int = Field(default=3, ge=0, le=3)
    postseason: bool = False
    ot_period: int = Field(default=1, ge=1)
    ot_completed: int = Field(default=0, ge=0, le=3)
    finished: bool = False
    plays_elapsed: int = Field(default=0, ge=0)
    safety_kick: bool = False
    down: int = Field(default=0, ge=0, le=4)
    distance: int = Field(default=10, ge=-1, le=100)
    loc: int = Field(default=50, ge=0, le=100)
    target: int = Field(default=40, ge=0, le=100)
    possession: Literal[-1, 1] = 1
    drive: bool = False
    message: str = ""
    pending_xp: bool = False

    @model_validator(mode="after")
    def valid_state(self):
        self.team1 = normalize_team(self.team1)
        self.team2 = normalize_team(self.team2)
        for coach in (self.coach1, self.coach2):
            if coach not in ("Human", "AI"):
                normalize_team(coach)
        if self.postseason and self.timing_mode != "clock":
            raise ValueError("Postseason requires clock mode")
        if self.pending_xp and self.drive:
            raise ValueError("An extra point cannot occur during an active drive")
        if self.timing_mode == "plays" and self.time > 500:
            raise ValueError("Play budget must be at most 500")
        if self.timing_mode == "clock" and not self.finished:
            upper = (
                (600 if not self.postseason and min(self.year1, self.year2) >= 2017 else 900)
                if self.period == 5
                else (5 - self.period) * 900
            )
            lower = 0 if self.period == 5 else (4 - self.period) * 900
            if not lower <= self.time <= upper:
                raise ValueError("Clock does not match the current period")
        if self.drive and (self.down < 1 or self.loc < 1 or self.loc > 99):
            raise ValueError("An active drive requires down 1-4 and yardline 1-99")
        if self.drive and self.distance != self.loc - self.target:
            raise ValueError("Distance must match yardline minus first-down target")
        if self.drive and self.distance < 1:
            raise ValueError("An active drive requires a positive distance")
        return self


class AdvanceRequest(BaseModel):
    state: GameState
    choice: Literal[-3, -2, -1, 0, 1, 2, 3, 4, 5, 6]
    seed: Optional[int] = None


class PredictionRequest(BaseModel):
    down: int = Field(ge=1, le=4)
    distance: int = Field(ge=1, le=100)
    loc: int = Field(ge=1, le=99)
    time: int = Field(ge=0, le=3600)
    timing_mode: Literal["clock", "plays"] = "plays"
    score_diff: int
    year: int = Field(ge=1999, le=2100)
    team: str = "NFL"
    seed: int = 25

    @model_validator(mode="after")
    def valid_prediction(self):
        self.team = normalize_team(self.team)
        if self.timing_mode == "plays" and self.time > 500:
            raise ValueError("Play budget must be at most 500")
        if self.distance > self.loc:
            raise ValueError("Distance cannot exceed yards to the endzone")
        return self


class SeasonSimulationRequest(BaseModel):
    season: int = Field(ge=2002, le=2100)
    seed: int = Field(default=25, ge=0, le=2147483647)
    playoffs: bool = True
