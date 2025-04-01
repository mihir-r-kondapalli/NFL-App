from ObjGame import Game
from dbai import DBAI
import numpy as np

num_plays = 150  # Set num_plays as needed

class Computer:
    def __init__(self, ai):
        self.ai = ai
    
    def intrct(self, game):
        return self.ai.get_opt_play(game.field.down, game.field.get_distance(), game.field.loc)
    
    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

def update_score(game, score_type, player=None):
    if score_type == "TD":
        game.update_score(game.TD)
        player.xp_intrct(game)
    elif score_type == "FG":
        game.update_score(game.FG)
    elif score_type == "SFT":
        game.update_score(game.SFT)

ai_bia = DBAI("biased/max_eps.csv", "biased/opt_choices.csv")

def sim_game(player1, player2=Computer(ai_bia)):
    game = Game("AI1", "AI2", num_plays) 
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

    return game.team1.score, game.team2.score
