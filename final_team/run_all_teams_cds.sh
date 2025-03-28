#!/bin/bash

# List of all NFL team abbreviations
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LAR" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check if argument 3 (random seed) is provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <random_seed>"
    exit 1
fi

arg3=$1  # Command-line input (random seed)

# Loop through each NFL team and run the command
for team in "${nfl_teams[@]}"; do
    echo "Running simulation for team: $team with seed: $arg3"
    ./run_coach_decisions.sh -q "$team"
done

echo "All simulations completed!"