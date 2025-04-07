import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import random
import numpy as np

class StrategyAgent(nn.Module):
    def __init__(self, lr=0.01, eps = 1, eps_decay = 0.995, min_eps = 0.01):
        super(StrategyAgent, self).__init__()

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
            nn.Linear(32, 4)
        )

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.to(self.device)

        self.optimizer = optim.Adam(self.parameters(), lr=lr)
        self.scheduler = torch.optim.lr_scheduler.StepLR(self.optimizer, step_size=1000, gamma=0.9)

        self.trajectory = []  # List of (log_prob, reward, entropy)
        self.epsilon = eps
        self.epsilon_decay = eps_decay
        self.min_epsilon = min_eps

    def forward(self, state):
        return self.net(state)

    def select_action(self, state, game):
        state_tensor = torch.tensor(state, dtype=torch.float32).to(self.device)
        logits = self.net(state_tensor)
        action_probs = F.softmax(logits, dim=-1)
        action_dist = torch.distributions.Categorical(probs=action_probs)

        action = action_dist.sample()
        log_prob = action_dist.log_prob(action)
        entropy = action_dist.entropy()

        return action.item()+1, log_prob, entropy

    def xp_intrct(self, game):
        if np.random.uniform(0, 1) <= 0.945:
            game.update_score(game.XP)

    def record(self, log_prob, reward, entropy):
        self.trajectory.append((log_prob, reward, entropy))

    def end_episode(self):
        self.epsilon = max(self.min_epsilon, self.epsilon * self.epsilon_decay)

    def train(self):
        if not self.trajectory:
            return

        self.optimizer.zero_grad()

        log_probs, rewards, entropies = zip(*self.trajectory)
        rewards = torch.tensor(rewards, dtype=torch.float32).to(self.device)

        rewards = torch.tanh(rewards / 50.0)  # reward shaping

        # After computing all G values:
        returns = []
        G = 0
        gamma = 0.99
        for _, reward, _ in reversed(self.trajectory):
            G = reward + gamma * G
            returns.insert(0, G)  # prepend

        returns = torch.tensor(returns).to(self.device)
        baseline = returns.mean()

        loss = 0.0
        for (log_prob, _, entropy), Gt in zip(self.trajectory, returns):
            advantage = Gt - baseline
            loss -= log_prob * advantage
            loss -= 0.01 * entropy

        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
        self.optimizer.step()
        self.scheduler.step()

        self.trajectory = []
        return loss.item()

    def load_model(self, path):
        self.load_state_dict(torch.load(path))