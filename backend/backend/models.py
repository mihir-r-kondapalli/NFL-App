from pydantic import BaseModel, Field
from typing import List, Optional

# Pydantic models for request/response validation
class SimulationRequest(BaseModel):
    team1: str = Field(..., description="First team abbreviation")
    team2: str = Field(..., description="Second team abbreviation")
    year1: int = Field(..., description="First team year")
    year2: int = Field(..., description="Second team year")
    num_games: int = Field(1, description="Number of games to simulate")
    num_plays: int = Field(150, description="Number of plays per game")

class SimulationResponse(BaseModel):
    win_probability: float
    team1_scores: List[int]
    team2_scores: List[int]
    avg_score_team1: float
    avg_score_team2: float

class GameState(BaseModel):
    down: int
    distance: int
    loc: int
    time: int
    score_diff: int

class PredictionResponse(BaseModel):
    action: int