from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import os
from dotenv import load_dotenv
import uvicorn
import traceback

# Import from other modules
from predict import predict_action
from simulate import sim_games, Matchup, nfl_teams
from models import SimulationRequest, SimulationResponse, GameState, PredictionResponse

# Load environment variables
load_dotenv()

# API settings
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info")

# CORS Settings
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS").split(",")

app = FastAPI(
    title="Football Game Simulation API",
    description="API for simulating football games between different decision-making strategies",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Football Game Simulation API", "status": "healthy", "model": "Strategy AI"}

@app.post("/predict", response_model=PredictionResponse)
async def predict_endpoint(game_state: GameState):
    """
    Predict the best football strategy action based on the current game state.
    """
    try:
        # Get prediction from model
        action = predict_action(
            game_state.down,
            game_state.distance,
            game_state.loc,
            game_state.time,
            game_state.score_diff
        )
        
        return PredictionResponse(action=action)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/simulate", response_model=SimulationResponse)
async def simulate_games(request: SimulationRequest):
    """Simulate football games between two teams"""
    try:
        if request.team1 not in nfl_teams:
            raise HTTPException(status_code=400, detail=f"Team {request.team1} not found")
        if request.team2 not in nfl_teams:
            raise HTTPException(status_code=400, detail=f"Team {request.team2} not found")
            
        request.team1 = 'LA' if request.team1 == 'LAR' else request.team1
        request.team2 = 'LA' if request.team2 == 'LAR' else request.team2

        # Create matchup and simulate games
        matchup = Matchup(request.team1, request.team2, request.year1, request.year2, request.num_plays)
        win_prob, team1_scores, team2_scores = sim_games(matchup, request.num_games)
        
        # Convert numpy arrays to lists for JSON serialization
        team1_scores_list = team1_scores.tolist()
        team2_scores_list = team2_scores.tolist()
        
        return SimulationResponse(
            win_probability=win_prob,
            team1_scores=team1_scores_list,
            team2_scores=team2_scores_list,
            avg_score_team1=float(np.mean(team1_scores)),
            avg_score_team2=float(np.mean(team2_scores))
        )
    except ValueError as e:
        print(e.trac)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error in simulation: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error in simulation: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("api:app", host=HOST, port=PORT, log_level=LOG_LEVEL)