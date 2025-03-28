#!/bin/bash

# List of all NFL team abbreviations
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LAR" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check if arguments are provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <minimum number of samples> <random_seed>"
    exit 1
fi

arg2=$1  # Threshold
arg3=$2  # Command-line input (random seed)

# Loop through each NFL team and run the command
for team in "${nfl_teams[@]}"; do
    echo "Running simulation for team: $team with seed: $arg3"
    ./run_biased_simulation.sh -q "$team" "$arg2" "$arg3"
done

echo "All simulations completed!"