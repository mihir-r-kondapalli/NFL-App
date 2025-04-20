import pandas as pd
import numpy as np

# Database AI
class DBAI:
    def __init__(self, ep_csv_file, decision_file):
        """Load the CSV file into a DataFrame."""
        self.dfe = pd.read_csv(ep_csv_file)
        self.dfd = pd.read_csv(decision_file)


    def get_next_play(self, down, distance, yardline):
        """
        Returns a randomly chosen play based on probabilities:
        - 1: Run
        - 2: Pass
        - 3: Kick (Field Goal)
        - 4: Punt
        """
        # Filter for the exact situation
        situation = self.dfd[
            (self.dfd["down"] == down) &
            (self.dfd["distance"] == distance) &
            (self.dfd["yardline"] == yardline)
        ]

        if not situation.empty:
            probs = situation[["run", "pass", "kick", "punt"]].values[0]
            probs = probs / probs.sum()
            play = np.random.choice([1, 2, 3, 4], p=probs)
            return play

        # Fallback: Use average probabilities for this down
        down_situations = self.dfd[self.dfd["down"] == down]
        if not down_situations.empty:
            avg_probs = down_situations[["run", "pass", "kick", "punt"]].mean().values
            play = np.random.choice([1, 2, 3, 4], p=avg_probs / avg_probs.sum())  # Normalize just in case
            return play

        # Final fallback: Default to Punt
        return 4
    
    def get_ep(self, down, distance, yardline):
        # Filter for the given situation
        situation = self.dfe[
            (self.dfe["Down"] == down) &
            (self.dfe["Distance"] == distance) &
            (self.dfe["Yardline"] == yardline)
        ]

        if not situation.empty:
            return round(situation["EP"].values[0], 3)
        
        return -1000
    
    def get_opt_play(self, down, distance, yardline):
        # Filter for the given situation
        situation = self.dfe[
            (self.dfe["Down"] == down) &
            (self.dfe["Distance"] == distance) &
            (self.dfe["Yardline"] == yardline)
        ]

        # If exact match found, return the optimal choice
        if not situation.empty:
            return int(situation["Opt_Choice"].values[0])+1
        
        # Fallback: Use the most common choice for the given down
        most_common_choice = self.dfo[self.dfo["Down"] == down]["Opt_Choice"].mode()
        return int(most_common_choice[0]+1) if not most_common_choice.empty else 4  # Default to Punt