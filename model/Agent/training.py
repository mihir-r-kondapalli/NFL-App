import torch
from dbai import DBAI
from GameEnv import FootballEnv
import pandas as pd
import numpy as np
from Agent import StrategyAgent  # Import the updated agent

# Load DBAI (Opponent AI)
ai_bia = DBAI("biased/max_eps.csv", "biased/opt_choices.csv")
ai_nfl = DBAI("nflep/nfl_pbp_data.csv", "nflep/opt_choices.csv")

# Initialize Learnable AI Player
player1_ai = StrategyAgent()

# **Load Existing Model if Available**
model_path = "strategy_model.pth"
player1_ai.load_model(model_path)  # ✅ Now model loads instead of starting fresh

class Computer:
    def __init__(self, ai):
        self.ai = ai
    
    def intrct(self, game):
        return self.ai.get_opt_play(game.field.down, game.field.get_distance(), game.field.loc)
    
    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

# Create the environment
env = FootballEnv(player1=player1_ai, player2=Computer(ai_nfl))

score1s = []
score2s = []
rewards = []

# Training parameters
num_episodes = 1000
N = 20  # Each episode simulates 20 games
batch_size = 16

temp_init = 2
temp_final = 0.1
decay_factor = 0.999  # ✅ Slower decay for better exploration

for episode in range(num_episodes):
    env.reset()

    tot_score1 = 0.0
    tot_score2 = 0.0
    wins = 0.0

    for i in range(N):
        # Run sim_game(), getting the final score
        score1, score2 = env.sim_game(player1_ai)
        tot_score1 += score1
        tot_score2 += score2
        if score1 > score2:
            wins += 1
        elif score1 == score2:
            wins += 0.5

    final_score_diff = tot_score1 - tot_score2

    # Train strategy agent based on averaged final score difference
    if episode > batch_size:
        player1_ai.train(final_score_diff)

    # Save results
    avg_score1 = tot_score1 / N
    avg_score2 = tot_score2 / N

    score1s.append(avg_score1)
    score2s.append(avg_score2)
    rewards.append(final_score_diff)

    # Adjust temperature for exploration
    player1_ai.temperature = max(temp_final, temp_init * (decay_factor ** episode))

    print(f"Episode {episode+1}/{num_episodes}, Score: {avg_score1}-{avg_score2}, Final Reward: {final_score_diff:.2f}, Temperature: {player1_ai.temperature:.3f}, Win %: {wins/N:.3f}")

# Save training results
df = pd.DataFrame({'Score1': score1s, 'Score2': score2s, 'Reward': rewards})
df.to_csv('score_data.csv')

# **Save the trained model**
player1_ai.save_model(model_path)

print("✅ Training complete! Strategy model saved.")
