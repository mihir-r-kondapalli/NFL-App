import numpy as np
import gym
from gym import spaces
from ObjGame import Game
import pandas as pd
from GamePlayer import sim_game  # This function runs the full game

class FootballEnv(gym.Env):
    """Football Environment for training an AI player using `sim_game()`."""

    def __init__(self, num_plays=150, player1=None, player2=None, ep_file="biased/max_eps.csv"):
        super(FootballEnv, self).__init__()

        self.num_plays = num_plays
        self.player1 = player1  # PPO Agent
        self.player2 = player2  # Opponent AI (DBAI)

        # Load Expected Points (EP) Data
        self.dfe = pd.read_csv(ep_file)

        # Define Action Space: Not used since AI dynamically picks plays
        self.action_space = spaces.Discrete(4)

        # Define State Space: (down, distance, yardline, time_remaining, score_difference)
        self.observation_space = spaces.Box(low=np.array([1, 0, 1, 0, -100]),
                                            high=np.array([4, 100, 100, 3600, 100]),
                                            dtype=np.float32)

        self.game = None

    def reset(self):
        """Reset the environment for a new game (episode)."""
        self.game = Game("AI1", "AI2", self.num_plays)
        self.game.toss()
        self.game.kickoff()  # Start the game

    def sim_game(self, player1):
        """Runs a full game simulation using the AI player."""
        if self.player2 == None:
            return sim_game(player1)  # Returns final score difference
        else:
            return sim_game(player1, player2=self.player2)

    def render(self):
        """Returns the final game score for analysis."""
        score1 = self.game.team1.score
        score2 = self.game.team2.score
        return score1, score2
