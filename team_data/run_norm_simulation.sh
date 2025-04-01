#!/bin/bash

# List of valid NFL teams
nfl_teams=("ARI" "ATL" "BAL" "BUF" "CAR" "CHI" "CIN" "CLE" "DAL" "DEN" 
           "DET" "GB" "HOU" "IND" "JAX" "KC" "LV" "LAC" "LA" "MIA" 
           "MIN" "NE" "NO" "NYG" "NYJ" "PHI" "PIT" "SF" "SEA" "TB" 
           "TEN" "WAS")

# Check for quiet mode flag (-q)
QUIET_MODE=false
if [[ "$1" == "-q" ]]; then
    QUIET_MODE=true
    shift  # Remove the flag from arguments
fi

# Check the number of arguments
if [ "$#" -eq 1 ]; then
    arg0=$1
    arg1=5  # Default value if arg0 is missing
elif [ "$#" -eq 2 ]; then
    arg0=$1
    arg1=$2
else
    echo "Usage: $0 [-q] arg0 [arg1]"
    echo "-q: Quiet mode (only show progress updates and replace final number with runtime)"
    echo "arg0: team abbreviation"
    echo "arg1: minimum number of elements for a down, distance, yardline to be sampled"
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
mkdir "team-data/${arg0}"

run_command "Rscript rscripts/data_opt.R \"$arg0\" \"$arg1\"" "Processing data"
# run_command "Rscript coach_data.R \"$arg0\"" "Processing decision data"
run_command "Rscript rscripts/cdf.R \"$arg1\"" "Generating cdfs"

cp -R cdf_data "team-data/${arg0}/"

# Run the simulation binaries
run_command "./executables/simulator_norm.out nfl_eps/norm_eps.csv team-data/${arg0}/norm_eps.csv aux_data/punt_net_yards.json cdf_data team-data/${arg0}/coach_decision_probs_${arg0}.csv" "Running simulation"

echo "Simulation completed successfully!"