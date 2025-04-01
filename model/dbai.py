import pandas as pd

# Database AI
class DBAI:
    def __init__(self, ep_csv_file, decision_file):
        """Load the CSV file into a DataFrame."""
        self.dfe = pd.read_csv(ep_csv_file)
        self.dfo = pd.read_csv(decision_file)

    def get_next_play(self, down, distance, yardline):
        """
        Returns the play choice:
        - 1: Run
        - 2: Pass
        - 3: Kick (Field Goal)
        - 4: Punt
        """
        # Filter for the given situation
        situation = self.dfo[
            (self.dfo["Down"] == down) &
            (self.dfo["Distance"] == distance) &
            (self.dfo["Yardline"] == yardline)
        ]

        # If exact match found, return the optimal choice
        if not situation.empty:
            return int(situation["Optimal Choice"].values[0])+1
        
        # Fallback: Use the most common choice for the given down
        most_common_choice = self.dfo[self.dfo["Down"] == down]["Optimal Choice"].mode()
        return int(most_common_choice[0]+1) if not most_common_choice.empty else 4  # Default to Punt
    
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