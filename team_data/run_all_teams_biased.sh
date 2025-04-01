#!/bin/bash

# List of all NFL team abbreviations
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LA" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check if arguments are provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <minimum number of samples>"
    exit 1
fi

arg2=$1  # Threshold

# Loop through each NFL team and run the command
for team in "${nfl_teams[@]}"; do
    echo "Running simulation for team: $team"
    ./run_biased_simulation.sh -q "$team" "$arg2"
    echo ""
done

echo "All simulations completed!"