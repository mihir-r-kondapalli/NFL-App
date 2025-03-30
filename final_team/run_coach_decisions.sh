#!/bin/bash

# Check for quiet mode flag (-q)
QUIET_MODE=false
if [[ "$1" == "-q" ]]; then
    QUIET_MODE=true
    shift  # Remove the flag from arguments
fi

nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LA" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check the number of arguments
if [ "$#" -eq 1 ]; then
    arg0=$1
else
    echo "Usage: $0 [-q] arg0"
    echo "-q: Quiet mode (only show progress updates and replace final number with runtime)"
    echo "arg0: team abbreviation"
    exit 1
fi

# **🔹 Validate `arg0` against the list of valid NFL teams**
if [[ ! " ${nfl_teams[@]} " =~ " ${arg0} " ]]; then
    echo "Error: Invalid team abbreviation '${arg0}'."
    echo "Valid teams: ${nfl_teams[*]}"
    exit 1
fi

# Function to run a command with optional output suppression
run_command() {
    local cmd="$1"
    local desc="$2"

    echo ""
    echo -n "$desc..."
    echo ""

    # Measure start time
    START_TIME=$(date +%s)

    if [ "$QUIET_MODE" = true ]; then
        # Capture progress updates and replace the final one with runtime
        eval "$cmd" 2>&1 | while read -r line; do
            if [[ "$line" =~ ^[0-9] ]]; then
                echo -ne "\r$line  "
            fi
        done
        
        # Compute runtime
        END_TIME=$(date +%s)
        RUNTIME=$((END_TIME - START_TIME))

        # Overwrite the last progress update with completion time
        echo -ne "\r$desc completed in $RUNTIME seconds.      \n"
    else
        # Normal execution with full output
        eval "$cmd"
    fi
}

mkdir "team-data/biased_eps_${arg0}"

run_command "Rscript coach_data.R \"$arg0\"" "Processing decision data"

echo "Completed successfully!"