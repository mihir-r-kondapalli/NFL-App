import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

class CompressedStrategyModel:
    def __init__(self, model_path='agent_tie.pth'):
        """
        A compressed version of the StrategyAgent that only handles inference.
        
        Args:
            model_path (str): Path to the trained model weights
        """
        # Define the neural network architecture
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
        
        # Use GPU if available
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.net.to(self.device)
        
        # Load the trained model weights
        try:
            state_dict = torch.load(model_path, map_location=self.device)
            # Handle different state_dict formats
            if hasattr(state_dict, 'net'):
                self.net.load_state_dict(state_dict.net)
            elif isinstance(state_dict, dict) and 'net.0.weight' in state_dict:
                self.net.load_state_dict(state_dict)
            else:
                # Try to extract just the network parameters
                cleaned_state_dict = {k.replace('net.', ''): v for k, v in state_dict.items() 
                                    if k.startswith('net.')}
                self.net.load_state_dict(cleaned_state_dict)
            print(f"Model loaded successfully from {model_path}")
        except Exception as e:
            print(f"Error loading model: {e}")
    
    def predict(self, down, distance, loc, time, score_diff):
        """
        Predict the best action given the game state.
        
        Args:
            down (int): Current down (1-4)
            distance (float): Distance to first down
            loc (float): Current yard line
            time (float): Remaining time
            score_diff (float): Score difference
            
        Returns:
            int: Action code (1=RUN, 2=PASS, 3=KICK, 4=PUNT)
        """
        # Create state tensor
        state = torch.tensor([down, distance, loc, time, score_diff], 
                            dtype=torch.float32).to(self.device)
        
        # Get logits from model
        with torch.no_grad():
            logits = self.net(state)
            action_probs = F.softmax(logits, dim=-1)
        
        # Apply action masks based on game state
        mask = torch.ones(4, dtype=torch.bool).to(self.device)
        
        # Disallow KICK if: (down != 4 and time > 30) OR yardline >= 45
        if (down != 4 and time > 30) or loc >= 45:
            mask[2] = False  # mask out KICK
        
        # Disallow PUNT if: down != 4 OR yardline <= 30
        if down != 4 or loc <= 30:
            mask[3] = False  # mask out PUNT
            
        # Apply the mask
        masked_probs = action_probs.clone()
        masked_probs[~mask] = 0
        
        if masked_probs.sum() == 0:
            # Fallback: uniform distribution over legal actions (RUN, PASS)
            masked_probs[:2] = 0.5
        else:
            masked_probs = masked_probs / masked_probs.sum()
            
        # Get the most likely action (deterministic)
        action = torch.argmax(masked_probs).item() + 1
        
        return action

# Simple API function - no Flask dependencies
def get_action(down, distance, loc, time, score_diff):
    """
    Simple function to get action prediction without web framework
    """
    global _model
    
    # Initialize model if not already done
    if '_model' not in globals():
        _model = CompressedStrategyModel()
        
    return _model.predict(down, distance, loc, time, score_diff)