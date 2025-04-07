from ObjGame import Game
from dbai import DBAI
from play_data import Play_Data
import numpy as np

def update_score(game, score_type, player=None):
    if score_type == "TD":
        game.update_score(game.TD)
        player.xp_intrct(game)
    elif score_type == "FG":
        game.update_score(game.FG)
    elif score_type == "SFT":
        game.update_score(game.SFT)

def sim_step(action, curr_player, game, drive):        
        
    choice = curr_player.intrct(game) if action == -1 else action

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

    if not drive:
        game.kickoff()
        drive = True


def sim_game(name1, name2, player1, player2, play_data1, play_data2, num_plays):

    game = Game(name1, name2, num_plays, play_data1, play_data2) 
    playing = True

    game.toss()
    drive = False
    curr_player = None

    if not drive:
        game.kickoff()
        drive = True

    while playing:
        curr_player = player1 if game.pos.name == game.team1.name else player2
        sim_step(curr_player, game, drive)

        if game.is_done():
            playing = False

    return game.team1.score, game.team2.score