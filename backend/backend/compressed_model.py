import torch
import torch.nn as nn
import torch.nn.functional as F

class CompressedStrategyModel:
    def __init__(self, model_path='agent_tie.pth'):
        """
        A compressed inference-only model matching StrategyAgent architecture.
        """
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
            nn.Linear(256, 512),
            nn.ReLU(),
            nn.LayerNorm(512),
            nn.Linear(512, 256),
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
        self.net.to(self.device)

        # Load weights (handling both full agent and net-only formats)
        try:
            state_dict = torch.load(model_path, map_location=self.device)

            # If keys are prefixed with 'net.', strip the prefix
            if any(k.startswith("net.") for k in state_dict.keys()):
                state_dict = {k.replace("net.", ""): v for k, v in state_dict.items()}

            self.net.load_state_dict(state_dict)
            print(f"Model loaded successfully from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")

    def predict(self, down, distance, loc, time, score_diff):
        """
        Predict the best action given the game state.
        """
        state = torch.tensor([down, distance, loc, time, score_diff],
                             dtype=torch.float32).to(self.device)

        with torch.no_grad():
            logits = self.net(state)
            action_probs = F.softmax(logits, dim=-1)

        # Create mask for legal actions
        mask = torch.ones(4, dtype=torch.bool).to(self.device)

        # Mask out KICK (index 2) if not 4th down or too far upfield
        if (down != 4 and time > 30) or loc >= 45:
            mask[2] = False

        # Mask out PUNT (index 3) if not 4th down or too close
        if down != 4 or loc <= 30:
            mask[3] = False

        masked_probs = action_probs.clone()
        masked_probs[~mask] = 0

        if masked_probs.sum() == 0:
            masked_probs[:2] = 0.5  # fallback to uniform RUN/PASS
        else:
            masked_probs = masked_probs / masked_probs.sum()

        action = torch.argmax(masked_probs).item() + 1
        return action

# API-friendly function
_model = None

def get_action(down, distance, loc, time, score_diff):
    global _model
    if _model is None:
        _model = CompressedStrategyModel()
    return _model.predict(down, distance, loc, time, score_diff)