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

if len(sys.argv) != 4:
    print("Need to input opponent name, number of plays per game, and initial epsilon")
    exit()

# Initialize our new Learnable AI Player
player1_ai = StrategyAgent(lr=0.001)
player1_ai.epsilon = float(sys.argv[3])

model_path = 'agent.pth'
if os.path.exists(model_path):
    print("Loading saved model...")
    #player1_ai.load_model(model_path)
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

# --- Setup Opponent ---
opp = sys.argv[1].upper()
num_plays = int(sys.argv[2])

play_data_nfl = Play_Data("nfl_cdf_data", "punt_net_yards.json")

if opp == "NFL":
    pd1 = play_data_nfl
    pd2 = play_data_nfl
    opponent_ai = DBAI("nfl_eps/norm_eps.csv", "nfl_decision_data/nfl_decisions.csv")
else:
    pd1 = Play_Data(("nfl_cdf_data", "team-data/"+opp+"/cdf_data_def"), "punt_net_yards.json")
    pd2 = Play_Data(("team-data/"+opp+"/cdf_data"), "punt_net_yards.json")
    opponent_ai = DBAI("team-data/"+opp+"/norm_eps.csv", f"team-data/{opp}/coach_decision_probs_{opp}.csv")

player2 = Computer(opponent_ai)

# Create the environment
env = FootballEnv(num_plays, "AI", opp, player1_ai, player2, pd1, pd2)

# --- Training Loop ---
score1s = []
score2s = []
rewards = []
losses = []

rolling_window = 50
rolling_rewards = deque(maxlen=rolling_window)

num_episodes = 1000
N = 30  # Games per episode

for episode in range(num_episodes):
    env.reset()
    tot_score1 = 0.0
    tot_score2 = 0.0
    wins = 0.0

    for i in range(N):
        # Simulate a game
        score1, score2 = env.sim_game(player1_ai)
        
        # Calculate reward (could be just score difference or something more complex)
        game_reward = score1 - score2
        
        tot_score1 += score1
        tot_score2 += score2
        if score1 > score2:
            wins += 1
        elif score1 == score2:
            wins += 0.5

    # Calculate final episode metrics
    final_score_diff = tot_score1 - tot_score2

    # End game and store log probs with reward
    player1_ai.end_game(env, game_reward)

    rolling_rewards.append(final_score_diff)
    rolling_mean = sum(rewards) / len(rewards) if rewards else 0
    
    # Train the agent after each N games
    player1_ai.train()
    
    # Logging
    avg_score1 = tot_score1 / N
    avg_score2 = tot_score2 / N

    score1s.append(avg_score1)
    score2s.append(avg_score2)
    rewards.append(final_score_diff)

    print(f"Episode {episode+1}/{num_episodes}, Score: {avg_score1:.1f}-{avg_score2:.1f}, "
            f"Reward: {final_score_diff:.2f}, Rolling Mean: {rolling_mean:.2f}, "
            f"Epsilon: {player1_ai.epsilon:.3f}, Win %: {wins/N:.3f}")

    if player1_ai.epsilon == player1_ai.min_epsilon:
        break

# Save results
df = pd.DataFrame({
    'Score1': score1s, 
    'Score2': score2s, 
    'Reward': rewards,
})
df.to_csv('score_data.csv')#, mode='a', header=False, index=False)

# Save the trained model
torch.save(player1_ai.state_dict(), 'agent.pth')

print("Training complete! Strategy model saved.")