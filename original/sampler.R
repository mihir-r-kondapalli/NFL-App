# Load necessary libraries
options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(jsonlite)
library(tidyverse)

# Define yardline bins (only for file naming)
yardline_bins <- list("1-10" = 1:10, "11-20" = 11:20, "21-99" = 21:99)

# Define play types (Passing and Rushing)
play_types <- c("pass", "rush")

# Function to sample a value using inverse transform sampling
sample_from_cdf <- function(cdf_table, n = 1) {
  random_values <- runif(n)  # Generate 'n' random numbers between 0 and 1

  # Find the smallest value where CDF is greater than the random number
  sampled_values <- sapply(random_values, function(u) {
    cdf_table$value[which.min(cdf_table$cdf < u)]  # Find corresponding value
  })
  
  return(sampled_values)
}

# Function to sample from each down & distance key
sample_from_cdf_file <- function(cdf_data, n = 10000) {
  sampled_results <- list()

  # Iterate over all down & distance keys in the dataset
  for (down_distance in names(cdf_data)) {
    cdf_table <- as_tibble(cdf_data[[down_distance]])  # Convert list to tibble
    
    # Sample data from the CDF
    sampled_results[[down_distance]] <- sample_from_cdf(cdf_table, n)
  }
  
  return(sampled_results)
}

# Process both passing and rushing data
for (play_type in play_types) {
  for (group in names(yardline_bins)) {  # Yardline bins are only used for file naming
    # Construct file path based on play type & yardline group
    cdf_file <- paste0("cdf_data/", play_type, "_cdf_distributions_yl", group, ".json")
    
    # Check if file exists
    if (!file.exists(cdf_file)) {
      print(paste("Skipping missing file:", cdf_file))
      next
    }
    
    # Load JSON CDF data
    cdf_data <- fromJSON(cdf_file)
    
    # Sample from all down & distance keys
    set.seed(31)  # Ensure reproducibility
    all_samples <- sample_from_cdf_file(cdf_data, 10000)
    
    # Save sampled data to JSON
    output_file <- paste0("sample_data/", play_type, "_sample_yl", group, ".json")
    write_json(all_samples, output_file, pretty = TRUE)
    
    print(paste("Finished sampling for", play_type, "yardline group:", group))
  }
}
