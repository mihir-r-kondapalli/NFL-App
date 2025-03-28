#!/bin/bash

# List of valid NFL teams
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LAR" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check for quiet mode flag (-q)
QUIET_MODE=false
if [[ "$1" == "-q" ]]; then
    QUIET_MODE=true
    shift  # Remove the flag from arguments
fi

# Check the number of arguments
if [ "$#" -eq 2 ]; then
    arg0=$1
    arg1=1  # Default value if arg0 is missing
    arg2=$2
elif [ "$#" -eq 3 ]; then
    arg0=$1
    arg1=$2
    arg2=$3
else
    echo "Usage: $0 [-q] arg0 [arg1] arg2"
    echo "-q: Quiet mode (only show progress updates and replace final number with runtime)"
    echo "arg0: team abbreviation"
    echo "arg1: minimum number of elements for a down, distance, yardline to be sampled"
    echo "arg2: random seed for simulation"
    echo "If arg1 is not provided, it defaults to 20."
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

mkdir "team-data"
mkdir "team-data/biased_eps_${arg0}"

run_command "Rscript data.R \"$arg0\" \"$arg1\"" "Processing data"
# run_command "Rscript coach_data.R \"$arg0\"" "Processing decision data"
run_command "Rscript cdf.R \"$arg1\"" "Generating cdfs"

cp -R cdf_data "team-data/biased_eps_${arg0}/"

# Run the simulation binaries
run_command "./biased_exec/simulator.out nfl_eps team-data/biased_eps_${arg0} \"$arg2\"" "Running simulation"

echo "Simulation completed successfully!"