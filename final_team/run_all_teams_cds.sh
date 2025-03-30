#!/bin/bash

# List of all NFL team abbreviations
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LA" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Loop through each NFL team and run the command
for team in "${nfl_teams[@]}"; do
    echo "Running program for team: $team"
    ./run_coach_decisions.sh -q "$team"
done

echo "All simulations completed!"