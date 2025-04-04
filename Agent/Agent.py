import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import random

class StrategyAgent(nn.Module):
    def __init__(self, lr=0.01):
        super(StrategyAgent, self).__init__()

        # Neural network: 5 inputs -> 1 output
        self.net = nn.Sequential(
            nn.Linear(5, 64),
            nn.ReLU(),
            nn.LayerNorm(64),
            nn.Linear(64, 128),
            nn.ReLU(),
            nn.LayerNorm(128),
            nn.Linear(128, 256),
            nn.ReLU(),
            nn.LayerNorm(256),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.LayerNorm(128),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.LayerNorm(64),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)  # Single output
        )

        self.optimizer = optim.Adam(self.parameters(), lr=lr)
        self.game_log_probs = []  # Stores total game log probability
        
        # Optional: for exploration during training
        self.epsilon = 1
        self.epsilon_decay = 0.995
        self.min_epsilon = 0.01

    def forward(self, state):
        return self.net(state)

    def intrct(self, game):
        """Make a decision based on game state, store log probability for the game"""
        state = [
            game.field.down,
            game.field.get_distance(),
            game.field.loc,
            game.time,
            game.get_score_difference()
        ]

        state_tensor = torch.FloatTensor(state)
        output_value = self.forward(state_tensor)
        probability = torch.sigmoid(output_value)

        # Initial action based on output
        prob_value = probability.item()
        if prob_value < 0.25:
            action = 1  # Run
        elif prob_value < 0.5:
            action = 2  # Pass
        elif prob_value < 0.75:
            action = 3  # Field Goal
        else:
            action = 4  # Punt

        # Exploration override
        if random.random() < self.epsilon:
            action = random.randint(1, 4)

        # Policy override: enforce situational rules
        if action == 3 and not (game.field.down == 4 or game.time <= 30):
            action = random.choice([1, 2])  # Replace FG with run/pass
        elif action == 4 and game.field.down != 4:
            action = random.choice([1, 2, 3])  # Replace Punt with valid options

        # Calculate simple log-prob proxy
        log_prob = -((action - prob_value) ** 2)

        if not hasattr(game, 'agent_log_probs'):
            game.agent_log_probs = []
        game.agent_log_probs.append(log_prob)

        return action

    def xp_intrct(self, game):
        """Decide between XP (1) and 2-pt conversion (2) based on time and score_diff"""
        state = [0, 0, 0, game.time, game.get_score_difference()]  # Only time and score_diff are relevant

        state_tensor = torch.FloatTensor(state)
        output_value = self.forward(state_tensor)
        prob = torch.sigmoid(output_value).item()

        if random.random() < self.epsilon:
            action = random.choice([1, 2])  # Exploration
        else:
            action = 1 if prob < 0.5 else 2  # XP if prob < 0.5, else go for 2

        return action

    def end_game(self, game, final_score_diff):
        """Called at the end of each game to store the total game log probability"""
        if hasattr(game, 'agent_log_probs') and game.agent_log_probs:
            # Sum all log probabilities for this game
            total_log_prob = sum(game.agent_log_probs)
            
            # Store (total log prob, reward) tuple for this game
            self.game_log_probs.append((total_log_prob, final_score_diff))
            
            # Clear game's log probs
            game.agent_log_probs = []
        
        # Decay exploration rate
        self.epsilon = max(self.min_epsilon, self.epsilon * self.epsilon_decay)

    def train(self):
        """Update policy using stored game log probabilities"""
        if not self.game_log_probs:
            return

        self.optimizer.zero_grad()
        loss = 0.0

        # Calculate policy gradient loss
        for log_prob, reward in self.game_log_probs:
            loss -= log_prob * reward  # Policy gradient loss

        # Backward pass and optimization
        loss.backward()
        self.optimizer.step()
        
        # Clear stored game log probabilities
        self.game_log_probs = []
        
        return loss.item()
    
    def load_model(self, path):
        self.load_state_dict(torch.load(path))