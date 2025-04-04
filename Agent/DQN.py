import torch
import torch.nn as nn
import torch.optim as optim
import random
import numpy as np
from collections import deque

class DQN(nn.Module):
    """Deep Q-Network (DQN) with 4 hidden layers for selecting football plays."""
    def __init__(self, state_dim, action_dim):
        super(DQN, self).__init__()
        
        self.fc1 = nn.Linear(state_dim, 1024)
        self.fc2 = nn.Linear(1024, 512)
        self.fc3 = nn.Linear(512, 512)
        self.fc4 = nn.Linear(512, 256)
        self.fc5 = nn.Linear(256, action_dim)  # Output layer

        self.relu = nn.ReLU()

    def forward(self, state):
        x = self.relu(self.fc1(state))
        x = self.relu(self.fc2(x))
        x = self.relu(self.fc3(x))
        x = self.relu(self.fc4(x))
        x = self.fc5(x)  # Raw Q-values (no activation)
        return x

class DQNAgent:
    """DQN-based AI for selecting football plays."""
    def __init__(self, state_dim=5, action_dim=4, gamma=0.99, lr=0.001, buffer_size=10000, batch_size=32, prior_ai=None):
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.batch_size = batch_size
        self.prior_ai = prior_ai  # Prior AI knowledge

        self.policy_net = DQN(state_dim, action_dim)
        self.target_net = DQN(state_dim, action_dim)
        self.target_net.load_state_dict(self.policy_net.state_dict())  # Sync target network
        self.target_net.eval()

        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=lr)
        self.loss_fn = nn.SmoothL1Loss()  # Huber loss instead of MSE
        self.replay_buffer = deque(maxlen=buffer_size)  # ✅ Replay buffer added

        # Exploration strategy
        self.epsilon = 1.0  # Initial epsilon for ε-greedy strategy
        self.epsilon_min = 0.01
        self.epsilon_decay = 0.9999

        # Moving average tracking for stability
        self.reward_memory = deque(maxlen=100)  # Stores the last 100 rewards

    def load_model(self, model_path="dqn_model.pth"):
        """Load trained model from file."""
        self.policy_net.load_state_dict(torch.load(model_path))
        self.policy_net.eval()  # Set to evaluation mode

    def get_next_play(self, down, distance, yardline, time, score_diff):
        """Returns the best play (action) based on the current game state."""
        state = np.array([down, distance, yardline, time, score_diff], dtype=np.float32)
        return self.select_action(state)

    def select_action(self, state):
        """Choose an action using ε-greedy strategy with prior AI bias."""
        if random.random() < self.epsilon:
            # 50% chance to follow DBAI prior knowledge early on
            if self.prior_ai and random.random() < 0.5:
                return self.prior_ai.get_opt_play(state[0], state[1], state[2])
            else:
                return random.randint(1, self.action_dim)  # Random action
        else:
            with torch.no_grad():
                state_tensor = torch.tensor(state, dtype=torch.float32).unsqueeze(0)
                q_values = self.policy_net(state_tensor)
                return q_values.argmax().item() + 1  # Convert 0-based index to 1-based action

    def store_experience(self, state, action, reward, next_state, done):
        """Save experience to replay buffer with normalized rewards."""
        self.reward_memory.append(reward)
        avg_reward = sum(self.reward_memory) / len(self.reward_memory)
        normalized_reward = reward - avg_reward  # Normalize reward using moving average
        self.replay_buffer.append((state, action, normalized_reward, next_state, done))

    def train(self):
        """Train the Q-network using replay buffer"""
        if len(self.replay_buffer) < self.batch_size:
            return  # Not enough samples to train

        batch = random.sample(self.replay_buffer, self.batch_size)
        state, action, reward, next_state, done = map(np.array, zip(*batch))

        state = torch.tensor(state, dtype=torch.float32)
        action = torch.tensor(action, dtype=torch.long) - 1  # Convert action from 1-4 to 0-3
        reward = torch.tensor(reward, dtype=torch.float32)
        next_state = torch.tensor(next_state, dtype=torch.float32)
        done = torch.tensor(done, dtype=torch.float32)

        # Compute Q values
        q_values = self.policy_net(state).gather(1, action.unsqueeze(1)).squeeze(1)

        # Compute target Q values
        with torch.no_grad():
            max_next_q_values = self.target_net(next_state).max(1)[0]
            target_q_values = reward + (1 - done) * self.gamma * max_next_q_values

        # Compute loss and optimize
        loss = self.loss_fn(q_values, target_q_values)
        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

    def update_target_network(self, tau=0.005):
        """Soft update target network weights"""
        for target_param, param in zip(self.target_net.parameters(), self.policy_net.parameters()):
            target_param.data.copy_(tau * param.data + (1 - tau) * target_param.data)

    def decay_epsilon(self):
        """Reduce exploration rate over time"""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
