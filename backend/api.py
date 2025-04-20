from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Dict, Any
import uvicorn
from ObjGame import Game
from dbai import DBAI
from play_data import Play_Data
from compressed_model import CompressedStrategyModel
import pandas as pd
import numpy as np
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Football Game Simulation API",
    description="API for simulating football games between different decision-making strategies",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
DEFAULT_NUM_PLAYS = 130

# Initialize compressed model
model = CompressedStrategyModel()

# Pydantic models for request/response validation
class SimulationRequest(BaseModel):
    team1: str = Field(..., description="First team abbreviation")
    team2: str = Field(..., description="Second team abbreviation")
    year1: int = Field(..., description="First team year")
    year2: int = Field(..., description="Second team year")
    num_games: int = Field(1, description="Number of games to simulate")
    num_plays: int = Field(DEFAULT_NUM_PLAYS, description="Number of plays per game")

class SimulationResponse(BaseModel):
    win_probability: float
    team1_scores: List[int]
    team2_scores: List[int]

# Model-specific request and response classes
class GameState(BaseModel):
    down: int
    distance: int
    loc: int
    time: int
    score_diff: int

class PredictionResponse(BaseModel):
    action: int

class Computer:
    def __init__(self, ai):
        self.ai = ai
    
    def intrct(self, game):
        return self.ai.get_next_play(game.field.down, game.field.get_distance(), game.field.loc)
    
    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

class AI_Comp:
    def __init__(self, ai):
        self.ai = ai
        
    def intrct(self, game):
        state = np.array([
            game.field.down,
            game.field.get_distance(),
            game.field.loc,
            game.time,
            game.get_score_difference()
        ], dtype=np.float32)
        action, log_prob, entropy = self.ai.select_action(state, game)
        return action
        
    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

class GreedyComputer(Computer):
    def __init__(self, ai):
        super().__init__(ai)

    def intrct(self, game):
        return self.ai.get_opt_play(game.field.down, game.field.get_distance(), game.field.loc)

# Initialize global resources
ai_nfl = DBAI("nfl_eps/norm_eps.csv", "nfl_decision_data/nfl_decisions.csv")
play_data_nfl = Play_Data("nfl_cdf_data", "punt_net_yards.json")

class Matchup:
    def __init__(self, name1, name2, year1, year2, num_plays=DEFAULT_NUM_PLAYS):
        self.name1 = name1.upper()
        self.name2 = name2.upper()
        self.num_plays = num_plays

        self.player1 = (Computer(ai_nfl) if self.name1 == "NFL" else 
                        Computer(DBAI(f'team-data{year1}/'+self.name1+"/norm_eps.csv", f'team-data{year1}/'
                                      +self.name1+"/coach_decision_probs_"+self.name1+".csv")))
        self.player2 = (Computer(ai_nfl) if self.name2 == "NFL" else 
                        Computer(DBAI(f'team-data{year2}/'+self.name2+"/norm_eps.csv", f'team-data{year2}/'
                                      +self.name2+"/coach_decision_probs_"+self.name2+".csv")))
        
        if ((self.name1 == "NFL") and (self.name2 == "NFL")):
            self.pd1 = play_data_nfl
            self.pd2 = play_data_nfl
        elif (self.name1 == "NFL"):
            self.pd1 = Play_Data(("nfl_cdf_data", f'team-data{year2}/'+self.name2+"/cdf_data_def"), "punt_net_yards.json")
            self.pd2 = Play_Data((f'team-data{year2}/'+self.name2+"/cdf_data"), "punt_net_yards.json")
        elif (self.name2 == "NFL"):
            self.pd1 = Play_Data((f'team-data{year1}/'+self.name1+"/cdf_data"), "punt_net_yards.json")
            self.pd2 = Play_Data(("nfl_cdf_data", f'team-data{year1}/'+self.name1+"/cdf_data_def"), "punt_net_yards.json")
        else:
            self.pd1 = Play_Data((f'team-data{year1}/'+self.name1+"/cdf_data", f'team-data{year2}/'+self.name2+"/cdf_data_def"), "punt_net_yards.json")
            self.pd2 = Play_Data((f'team-data{year2}/'+self.name2+"/cdf_data", f'team-data{year1}/'+self.name1+"/cdf_data_def"), "punt_net_yards.json")

        if(self.name1 == self.name2):
            self.name1 += '1'
            self.name2 += '2'

def sim_game(matchup, num_games):
    list1 = []
    list2 = []
    wins = 0

    def update_score(game, score_type, player=None):
        if score_type == "TD":
            game.update_score(game.TD)
            player.xp_intrct(game)
        elif score_type == "FG":
            game.update_score(game.FG)
        elif score_type == "SFT":
            game.update_score(game.SFT)

    for i in range(0, num_games):
        player1 = matchup.player1
        player2 = matchup.player2

        game = Game(matchup.name1, matchup.name2, matchup.num_plays, matchup.pd1, matchup.pd2) 
        playing = True

        game.toss()
        drive = False
        curr_player = None

        while playing:
            curr_player = player1 if game.pos.name == game.team1.name else player2
            
            if not drive:
                game.kickoff()
                drive = True
            else:
                choice = curr_player.intrct(game)

                if choice == 1:
                    play, result, yards = game.run()
                    if result == 'touchdown':
                        update_score(game, "TD", player=curr_player)
                        game.switch_pos()
                        drive = False
                    elif result == 'turnover on downs':
                        game.switch_pos()
                        game.new_downs()
                    elif result == 'safety':
                        game.switch_pos()
                        game.update_score(game.SFT)
                        drive = False
                    elif play == 'rfumble':
                        game.switch_pos()
                        if result == 'touchdown':
                            game.touchback()
                        elif result == 'safety':
                            update_score(game, "TD", player=curr_player)
                            game.switch_pos()
                            drive = False
                        else:
                            game.new_downs()
                
                elif choice == 2:
                    play, result, yards = game.throw()
                    if result == 'touchdown':
                        update_score(game, "TD", player=curr_player)
                        game.switch_pos()
                        drive = False
                    elif result == 'turnover on downs':
                        game.switch_pos()
                        game.new_downs()
                    elif result == 'safety':
                        game.switch_pos()
                        game.update_score(game.SFT)
                        drive = False
                    elif play == 'pfumble':
                        game.switch_pos()
                        if result == 'touchdown':
                            game.touchback()
                        elif result == 'safety':
                            update_score(game, "TD", player=curr_player)
                            game.switch_pos()
                            drive = False
                        else:
                            game.new_downs()
                    elif play == 'int':
                        game.switch_pos()
                        if result == 'touchdown':
                            game.touchback()
                        elif result == 'safety':
                            update_score(game, "TD", player=curr_player)
                            game.switch_pos()
                            drive = False
                        else:
                            game.new_downs()
                
                elif choice == 3:
                    result, _ = game.kick()
                    if result == 'made':
                        update_score(game, "FG")
                        game.switch_pos()
                        drive = False
                    game.switch_pos()
                    game.new_downs()

                elif choice == 4:
                    result, yds = game.punt()
                    if result == 'touchback':
                        game.switch_pos()
                        game.touchback()
                    elif result == 'touchdown':
                        update_score(game, "TD", player=curr_player)
                        game.switch_pos()
                        drive = False
                    elif result == 'muffed punt':
                        game.new_downs()
                    elif result == 'return touchdown':
                        game.switch_pos()
                        update_score(game, "TD", player=curr_player)
                        game.switch_pos()
                        drive = False
                    else:
                        game.switch_pos()
                        game.new_downs()
            
            if game.is_done():
                playing = False

        list1.append(game.team1.score)
        list2.append(game.team2.score)

        if(game.team1.score > game.team2.score):
            wins += 1
        if(game.team1.score == game.team2.score):
            wins += 0.5

    return (1.0*wins/num_games, np.array(list1), np.array(list2))

nfl_teams=["ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
           "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
           "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
           "TEN", "WAS"]


@app.get("/")
async def root():
    return {"message": "Football Game Simulation API", "status": "healthy", "model": "Strategy AI"}

@app.post("/predict", response_model=PredictionResponse)
async def predict(game_state: GameState):
    """
    Predict the best football strategy action based on the current game state.
    
    - **down**: Current down (1-4)
    - **distance**: Distance to first down
    - **loc**: Current yard line
    - **time**: Remaining time
    - **score_diff**: Score difference
    
    Returns the action code (1=RUN, 2=PASS, 3=KICK, 4=PUNT)
    """
    try:
        # Get prediction from model
        action = model.predict(
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
        win_prob, team1_scores, team2_scores = sim_game(matchup, request.num_games)
        
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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in simulation: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)