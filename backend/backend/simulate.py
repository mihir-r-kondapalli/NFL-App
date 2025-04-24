import numpy as np
from ObjGame import Game
from dbai import DBAI
from play_data import Play_Data
import time

# NFL teams constant
nfl_teams = ["ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
           "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
           "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
           "TEN", "WAS"]

# Initialize global resources
ai_nfl = DBAI("nfl_eps/norm_eps.csv", "nfl_decision_data/nfl_decisions.csv")
play_data_nfl = Play_Data("nfl_cdf_data", "punt_net_yards.json")

class Computer:
    def __init__(self, ai):
        self.ai = ai
    
    def intrct(self, game):
        return self.ai.get_next_play(game.field.down, game.field.get_distance(), game.field.loc)
    
    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

class Matchup:
    def __init__(self, name1, name2, year1, year2, num_plays=150):
        self.name1 = name1.upper()
        self.name2 = name2.upper()
        self.num_plays = num_plays

        self.player1 = (Computer(ai_nfl) if self.name1 == "NFL" else 
                      Computer(DBAI(f'team-data{year1}/'+self.name1+"/norm_eps.csv", f'team-data{year1}/'
                                    +self.name1+"/coach_decision_probs_"+self.name1+".csv")))
        self.player2 = (Computer(ai_nfl) if self.name2 == "NFL" else 
                      Computer(DBAI(f'team-data{year2}/'+self.name2+"/norm_eps.csv", f'team-data{year2}/'
                                    +self.name2+"/coach_decision_probs_"+self.name2+".csv")))
        
        # Handle play data initialization
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

def update_score(game, score_type, player=None):
    if score_type == "TD":
        game.update_score(game.TD)
        player.xp_intrct(game)
    elif score_type == "FG":
        game.update_score(game.FG)
    elif score_type == "SFT":
        game.update_score(game.SFT)

def sim_games(matchup, num_games):
    list1 = []
    list2 = []
    wins = 0

    start = time.time()

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

                # Run play
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
                
                # Pass play
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
                
                # Field goal
                elif choice == 3:
                    result, _ = game.kick()
                    if result == 'made':
                        update_score(game, "FG")
                        game.switch_pos()
                        drive = False
                    game.switch_pos()
                    game.new_downs()

                # Punt
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

    print(f'# Games: {num_games}, Runtime: {time.time()-start}')

    return (1.0*wins/num_games, np.array(list1), np.array(list2))