from ObjGame import Game
from dbai import DBAI
from play_data import Play_Data
import pandas as pd
import sys

import numpy as np

num_plays = 150  # Set num_plays as needed

import os
from Agent import StrategyAgent
player_ai = StrategyAgent()

model_path = 'agent_tie.pth'
if os.path.exists(model_path):
    print("Loading saved model...")
    player_ai.load_model(model_path)
else:
    print("No saved model found. Starting from scratch.")

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
        super(ai)

    def intrct(self, game):
        return self.ai.get_opt_play(game.field.down, game.field.get_distance(), game.field.loc)

def update_score(game, score_type, player=None):
    if score_type == "TD":
        game.update_score(game.TD)
        player.xp_intrct(game)
    elif score_type == "FG":
        game.update_score(game.FG)
    elif score_type == "SFT":
        game.update_score(game.SFT)

ai_nfl = DBAI("nfl_eps/norm_eps.csv", "nfl_decision_data/nfl_decisions.csv")

play_data_nfl = Play_Data("nfl_cdf_data", "punt_net_yards.json")

ai_player = AI_Comp(player_ai)

class Matchup:
    def __init__(self, name1, name2):
        self.name1 = name1.upper()
        self.name2 = name2.upper()

        self.player1 = (Computer(ai_nfl) if self.name1 == "NFL" else 
                        Computer(DBAI("team-data/"+self.name1+"/norm_eps.csv", "team-data/"
                                      +self.name1+"/coach_decision_probs_"+self.name1+".csv"))) if self.name1 != "AI" else ai_player
        self.player2 = (Computer(ai_nfl) if self.name2 == "NFL" else 
                        Computer(DBAI("team-data/"+self.name2+"/norm_eps.csv", "team-data/"
                                      +self.name2+"/coach_decision_probs_"+self.name2+".csv"))) if self.name2 != "AI" else ai_player
        
        if ((self.name1 == "NFL" or self.name1 == "AI") and (self.name2 == "NFL" or self.name2 == "AI")):
            self.pd1 = play_data_nfl
            self.pd2 = play_data_nfl
        elif (self.name1 == "NFL" or self.name1 == "AI"):
            self.pd1 = Play_Data(("nfl_cdf_data", "team-data/"+self.name2+"/cdf_data_def"), "punt_net_yards.json")
            self.pd2 = Play_Data(("team-data/"+self.name2+"/cdf_data"), "punt_net_yards.json")
        elif (self.name2 == "NFL" or self.name2 == "AI"):
            self.pd1 = Play_Data(("team-data/"+self.namepr1+"/cdf_data"), "punt_net_yards.json")
            self.pd2 = Play_Data(("nfl_cdf_data", "team-data/"+self.name1+"/cdf_data_def"), "punt_net_yards.json")
        else:
            self.pd1 = Play_Data(("team-data/"+self.name1+"/cdf_data", "team-data/"+self.name2+"/cdf_data_def"), "punt_net_yards.json")
            self.pd2 = Play_Data(("team-data/"+self.name2+"/cdf_data", "team-data/"+self.name1+"/cdf_data_def"), "punt_net_yards.json")

        if(self.name1 == self.name2):
            self.name1 += '1'
            self.name2 += '2'

list1 = []
list2 = []

if len(sys.argv) != 4:
    print("need to input team1 abbreviation, team2 abbreviation, and number of games")
    exit()

n = sys.argv[3]
if not n.isnumeric():
    print("need to input an integer")
    exit()

games = int(n)
wins = 0

matchup = Matchup(sys.argv[1], sys.argv[2])

for i in range(0, games):

    player1 = matchup.player1
    player2 = matchup.player2

    game = Game(matchup.name1, matchup.name2, num_plays, matchup.pd1, matchup.pd2) 
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
        wins+=1
    if(game.team1.score == game.team2.score):
        wins+=0.5

    print(f"{i+1:4d}: "+str(game.team1.score)+" - "+str(game.team2.score)+": "+str(round(1.0*wins/(i+1), 3)))


print("Win Probability: " + str(1.0*wins/games))
print(f"Average Score: {np.mean(np.array(list1))} - {np.mean(np.array(list2))}")

df = pd.DataFrame({'Score1': list1, 'Score2': list2})
#df.to_csv('score_data.csv', mode='a', header=False, index=False)
df.to_csv('score_data.csv')
