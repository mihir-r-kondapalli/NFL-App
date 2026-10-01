"""The original strategy network, shared by optional training and inference."""

import torch
from torch import nn


class StrategyAgent(nn.Module):
    def __init__(self, lr=0.0001):
        super().__init__()
        widths = [5, 64, 128, 256, 512, 256, 128, 64, 32, 4]
        layers = []
        for index, (input_size, output_size) in enumerate(zip(widths, widths[1:])):
            layers.append(nn.Linear(input_size, output_size))
            if index < len(widths) - 2:
                layers.append(nn.ReLU())
                if output_size != 32:
                    layers.append(nn.LayerNorm(output_size))
        self.net = nn.Sequential(*layers)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.to(self.device)
        self.optimizer = torch.optim.Adam(self.parameters(), lr=lr)
        self.scheduler = torch.optim.lr_scheduler.StepLR(self.optimizer, step_size=1000, gamma=0.9)
        self.trajectory = []

    def forward(self, state):
        return self.net(state)

    def record(self, log_prob, reward, entropy):
        self.trajectory.append((log_prob, reward, entropy))

    def optimize_episode(self):
        if not self.trajectory:
            return 0.0
        self.optimizer.zero_grad()
        returns = []
        total = 0.0
        for _, reward, _ in reversed(self.trajectory):
            total = reward + 0.99 * total
            returns.insert(0, total)
        returns = torch.tensor(returns, dtype=torch.float32, device=self.device)
        baseline = returns.mean()
        loss = sum(
            -log_prob * (value - baseline) - 0.01 * entropy
            for (log_prob, _, entropy), value in zip(self.trajectory, returns)
        )
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
        self.optimizer.step()
        self.scheduler.step()
        self.trajectory.clear()
        return float(loss.item())
