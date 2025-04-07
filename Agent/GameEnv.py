# New FootballEnv and compatible StrategyAgent with per-step interaction
import numpy as np
import gym
from gym import spaces
from ObjGame import Game
import pandas as pd
from GamePlayer import sim_step, update_score

class FootballEnv(gym.Env):

    RUN = 1
    PASS = 2
    KICK = 3
    PUNT = 4

    def __init__(self, num_plays, name1, name2, player1, player2, play_data1, play_data2, ep_file="nfl_eps/norm_eps.csv"):
        super(FootballEnv, self).__init__()

        self.num_plays = num_plays
        self.name1 = name1
        self.name2 = name2
        self.player1 = player1  # StrategyAgent
        self.player2 = player2  # Opponent
        self.play_data1 = play_data1
        self.play_data2 = play_data2
        self.init_diff = 0
        self.num_pos = 0

        self.dfe = pd.read_csv(ep_file)

        self.action_space = spaces.Discrete(4)
        self.observation_space = spaces.Box(low=np.array([1, 0, 1, 0, -100]),
                                            high=np.array([4, 100, 100, 3600, 100]),
                                            dtype=np.float32)

        self.game = None
        self.done = False
        self.drive = False

    def reset(self):
        self.game = Game(self.name1, self.name2, self.num_plays, self.play_data1, self.play_data2)
        self.game.toss()
        self.game.kickoff()
        self.drive = True
        self.done = False
        self.num_pos = 0
        return self._get_obs()

    def step(self, action):
        if self.done:
            raise ValueError("Step called after episode is done. Call reset().")
        
        self.num_pos += 1
        self.init_diff = self.game.get_expected_difference()
        current_player = self.player1 if self.game.pos.name == self.name1 else self.player2
        sim_step(action, current_player, self.game, self.drive)

        obs = self._get_obs()
        reward = self._get_reward()
        self.done = self.game.is_done()
        info = {"score1": self.game.team1.score, "score2": self.game.team2.score}
        return obs, reward, self.done, info
    
    def sim_opponent_drive(self):
        while(self.game.pos.name != self.name1) and not self.game.is_done():
            current_player = self.player1 if self.game.pos.name == self.name1 else self.player2
            sim_step(-1, current_player, self.game, self.drive)

        return self.game.is_done()

    def _get_obs(self):
        return np.array([
            self.game.field.down,
            self.game.field.get_distance(),
            self.game.field.loc,
            self.game.time,
            self.game.get_score_difference()
        ], dtype=np.float32)

    def _get_reward(self):
        # Simple reward: score differential from team1's perspective
        return self.game.get_expected_difference() - self.init_diff

    def render(self, mode="human"):
        print(f"Score: {self.game.team1.name} {self.game.team1.score} - {self.game.team2.name} {self.game.team2.score}")
