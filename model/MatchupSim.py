from ObjGame import Game
from dbai import DBAI
from play_data import Play_Data
import pandas as pd
import sys

import numpy as np

num_plays = 130  # Set num_plays as needed

class Computer:
    def __init__(self, ai):
        self.ai = ai
    
    def intrct(self, game):
        return self.ai.get_next_play(game.field.down, game.field.get_distance(), game.field.loc)
    
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

class Team:
    def __init__(self, name):
        name = name.upper()
        self.name = name
        if (name == "NFL"):
            self.pd = play_data_nfl
            self.player = Computer(ai_nfl)
        else:
            self.pd = Play_Data("team-data/"+name+"/cdf_data", "punt_net_yards.json")
            self.player = Computer(DBAI("team-data/"+name+"/norm_eps.csv", "team-data/"+name+"/coach_decision_probs_"+name+".csv"))

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

team1 = Team(sys.argv[1])
team2 = Team(sys.argv[2])

if(team1.name == team2.name):
    team1.name+='1'
    team2.name+='2'


for i in range(0, games):

    player1 = team1.player
    player2 = team2.player

    game = Game(team1.name, team2.name, num_plays, team1.pd, team2.pd) 
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


print(1.0*wins/games)

df = pd.DataFrame({'Score1': list1, 'Score2': list2})
#df.to_csv('score_data.csv', mode='a', header=False, index=False)
df.to_csv('score_data.csv')