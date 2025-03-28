# Load necessary libraries
library(jsonlite)
library(tidyverse)

yardline_bins <- list("1-10" = 1:10, "11-20" = 11:20, "21-99" = 21:99)

# Define play types (passing and rushing)
play_types <- c("pass", "rush")

# Function to compute CDF for each down-distance key
compute_cdf <- function(values) {
  if (length(values) < 5) return(NULL)  # Skip small datasets
  
  value_counts <- table(values)  # Count occurrences
  probs <- value_counts / sum(value_counts)  # Normalize to probabilities
  cdf <- cumsum(probs)  # Compute cumulative probabilities
  
  tibble(value = as.numeric(names(probs)), probability = as.numeric(probs), cdf = as.numeric(cdf))
}

# Loop over each yardline group and play type
for (group in names(yardline_bins)) {
  for (play_type in play_types) {
    # Construct file paths
    file_path <- paste0("distr_data/", play_type, "_distributions_yl", group, ".json")
    output_file <- paste0("cdf_data/", play_type, "_cdf_distributions_yl", group, ".json")
    
    # Check if file exists
    if (!file.exists(file_path)) {
      print(paste("⚠ Skipping missing file:", file_path))
      next
    }

    # Load JSON data (structured as down-distance keys)
    data_list <- fromJSON(file_path)

    # Compute CDF for each down-distance key
    cdf_distributions <- map(data_list, compute_cdf)

    # Remove NULL entries (keys with < 5 values)
    cdf_distributions <- discard(cdf_distributions, is.null)

    # If no valid data, skip this group
    if (length(cdf_distributions) == 0) {
      print(paste("⚠ No valid data for", play_type, "in yardline group:", group))
      next
    }

    # Save CDF distributions to JSON
    write_json(cdf_distributions, output_file, pretty = TRUE, auto_unbox = TRUE)
    print(paste("✅ CDF distributions saved for", play_type, "in yardline group:", group))
  }
}
