import torch
import torch.nn as nn
import torch.optim as optim
from collections import deque

class StrategyAgent(nn.Module):
    """AI Player that dynamically learns football strategies using a deep neural network."""
    def __init__(self):
        super(StrategyAgent, self).__init__()

        # **Neural Network Architecture**
        self.fc1 = nn.Linear(5, 64)  
        self.fc2 = nn.Linear(64, 128)  
        self.fc3 = nn.Linear(128, 64)  
        self.fc4 = nn.Linear(64, 32)  
        self.fc5 = nn.Linear(32, 16)  
        self.fc6 = nn.Linear(16, 4)  

        # **Residual Connections**
        self.shortcut = nn.Linear(5, 64)  

        # **Layer Normalization for Stable Training**
        self.ln1 = nn.LayerNorm(64)
        self.ln2 = nn.LayerNorm(128)
        self.ln3 = nn.LayerNorm(64)
        self.ln4 = nn.LayerNorm(32)

        # **Dropout for Regularization**
        self.dropout = nn.Dropout(p=0.2)

        self.relu = nn.ReLU()
        self.temperature = 1.5
        self.optimizer = optim.Adam(self.parameters(), lr=0.002)  # Lower LR for stability

        self.saved_log_probs = []
        self.rewards_memory = deque(maxlen=20)  # Store last 20 score differences

    def intrct(self, game):
        """Chooses a play dynamically based on learned strategy factors."""
        down, distance, yardline, time, score_diff = game.field.down, game.field.get_distance(), game.field.loc, game.time, game.get_score_difference()

        game_state = torch.tensor([down, distance, yardline, time, score_diff], dtype=torch.float32).unsqueeze(0)

        # Forward pass
        x = self.relu(self.ln1(self.fc1(game_state) + self.shortcut(game_state)))  # Residual Connection
        x = self.relu(self.ln2(self.fc2(x)))
        x = self.relu(self.ln3(self.fc3(x)))
        x = self.relu(self.ln4(self.fc4(x)))
        x = self.dropout(x)
        x = self.relu(self.fc5(x))
        play_logits = self.fc6(x)

        # Normalize logits before softmax
        play_logits = play_logits - play_logits.max(dim=-1, keepdim=True)[0]  # Prevent large exponentials

        # Compute softmax probabilities
        play_probs = torch.nn.functional.softmax(play_logits.squeeze(0) / self.temperature, dim=-1)

        # Clamp probabilities to avoid NaNs
        play_probs = torch.clamp(play_probs, min=1e-6, max=1.0)

        # Select action probabilistically
        action = torch.multinomial(play_probs, 1)
        log_prob = torch.log(play_probs[action])

        self.saved_log_probs.append(log_prob)  # Store log probability for training
        return action.item() + 1
            
    def xp_intrct(self, game):
        """Chooses XP (1) or 2PT (2) based on game state."""
        
        # Extract relevant game state variables
        time, score_diff = game.time, game.get_score_difference()

        # Convert state into a tensor
        game_state = torch.tensor([0, 0, 0, time, score_diff], dtype=torch.float32).unsqueeze(0)

        # Forward pass through the network
        x = self.relu(self.ln1(self.fc1(game_state)))
        x = self.relu(self.ln2(self.fc2(x)))
        x = self.relu(self.ln3(self.fc3(x)))
        x = self.relu(self.fc4(x))
        x = self.dropout(x)  # Regularization
        decision_logits = self.fc5(x)

        # Convert output to probability of going for 2
        two_point_prob = torch.sigmoid(decision_logits.squeeze(0)[1])  # Use the 2nd neuron for XP decision

        # Select XP or 2PT based on probability
        return 2 if torch.rand(1).item() < two_point_prob.item() else 1


    def train(self, final_score_diff):
        """Trains using policy gradient, averaging over last 20 games."""
        self.rewards_memory.append(final_score_diff)

        if len(self.rewards_memory) < 20:
            return  # Wait until we have 20 games stored

        avg_return = sum(self.rewards_memory) / len(self.rewards_memory)
        returns = torch.tensor([avg_return], dtype=torch.float32)

        # 🔹 Ensure returns is not empty before normalizing
        if returns.numel() == 0 or returns.std() == 0:
            print(f"⚠️ WARNING: Skipping normalization due to zero variance in returns: {returns}")
            returns = torch.tensor([0.0])  # Avoid division by zero

        else:
            returns = (returns - returns.mean()) / (returns.std() + 1e-8)

        policy_loss = [-log_prob * returns for log_prob in self.saved_log_probs]
        loss = torch.stack(policy_loss).sum()

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        self.saved_log_probs = []


    def save_model(self, filepath="strategy_model.pth"):
        """Saves the trained model."""
        torch.save(self.state_dict(), filepath)
        print(f"Model saved to {filepath}")

    def load_model(self, filepath="strategy_model.pth"):
        """Loads a previously trained model."""
        try:
            self.load_state_dict(torch.load(filepath))
            self.eval()  # Set model to evaluation mode
            print(f"Model loaded from {filepath}")
        except FileNotFoundError:
            print(f"No saved model found at {filepath}, starting fresh.")
