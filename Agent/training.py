import torch
from dbai import DBAI
from GameEnv import FootballEnv
import pandas as pd
import numpy as np
import sys
from play_data import Play_Data
from Agent import StrategyAgent  # Import our new agent
import os
from collections import deque

if len(sys.argv) != 3:
    print("Need to input opponent name, number of plays per game")
    exit()

player1_ai = StrategyAgent(
    lr=0.0001,
    eps = 0,
    eps_decay = 0,
    min_eps = 0
)

model_path = 'agent_10.pth'
if os.path.exists(model_path):
    print("Loading saved model...")
    player1_ai.load_model(model_path)
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

opp = sys.argv[1].upper()
num_plays = int(sys.argv[2])

play_data_nfl = Play_Data("nfl_cdf_data", "punt_net_yards.json")

if opp == "NFL":
    pd1 = play_data_nfl
    pd2 = play_data_nfl
    opponent_ai = DBAI("nfl_eps/norm_eps.csv", "nfl_decision_data/nfl_decisions.csv")
else:
    pd1 = Play_Data(("nfl_cdf_data", f"team-data/{opp}/cdf_data_def"), "punt_net_yards.json")
    pd2 = Play_Data((f"team-data/{opp}/cdf_data"), "punt_net_yards.json")
    opponent_ai = DBAI(f"team-data/{opp}/norm_eps.csv", f"team-data/{opp}/coach_decision_probs_{opp}.csv")

player2 = Computer(opponent_ai)

env = FootballEnv(num_plays, "AI", opp, player1_ai, player2, pd1, pd2)

score1s = []
score2s = []
rewards = []
losses = []

rolling_window = 300
rolling_rewards = deque(maxlen=rolling_window)
rolling_wps = deque(maxlen=rolling_window)

num_episodes = 10000

for episode in range(num_episodes):
    state = env.reset()
    total_reward = 0
    done = False

    while not done:
        if(env.game.pos.name != env.name1):
            done = env.sim_opponent_drive()
            continue
        action, log_prob, entropy = player1_ai.select_action(state, env.game)
        next_state, reward, done, info = env.step(action)
        player1_ai.record(log_prob, reward, entropy)
        total_reward += reward
        state = next_state

    player1_ai.end_episode()
    loss = player1_ai.train()

    score1 = info["score1"]
    score2 = info["score2"]
    final_score_diff = score1 - score2

    rolling_rewards.append(final_score_diff)
    rolling_reward = sum(rolling_rewards) / len(rolling_rewards)

    win = 1 if score1 > score2 else 0.5 if score1 == score2 else 0
    rolling_wps.append(win)
    rolling_wp = sum(rolling_wps) / len(rolling_wps)

    score1s.append(score1)
    score2s.append(score2)
    rewards.append(final_score_diff)

    print(f"Episode {episode+1}/{num_episodes}, Score: {int(score1):2d}-{int(score2):2d}, "
          f"Reward: {int(final_score_diff):3d}, Rolling Reward: {rolling_reward:.2f}, Rolling WP: {rolling_wp:.2f}, "
          f"Possessions: {env.num_pos:2d}, Epsilon: {player1_ai.epsilon:.3f}")
    
    if((episode+1) % 1000 == 0):
        torch.save(player1_ai.state_dict(), f"agent_{int((episode+1)/1000)}.pth")
        print(f"Model {int((episode+1)/1000)} Saved!")


df = pd.DataFrame({
    'Score1': score1s,
    'Score2': score2s,
    'Reward': rewards,
})
df.to_csv('score_data.csv', index=False)
print("Training complete! Strategy models saved.")