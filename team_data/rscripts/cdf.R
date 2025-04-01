# Load necessary libraries
options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(jsonlite)
library(tidyverse)

# Read threshold argument from command line
args <- commandArgs(trailingOnly = TRUE)
threshold <- if (length(args) == 0) 20 else as.numeric(args[1])

# Yardline bin definitions
individual_bins <- setNames(as.list(1:20), as.character(1:20))
grouped_bins <- list(
  "21-23" = 21:23, "24-27" = 24:27, "28-32" = 28:32,
  "33-38" = 33:38, "39-44" = 39:44, "45-50" = 45:50,
  "51-70" = 51:70, "71-85" = 71:85, "86-99" = 86:99
)
yardline_bins <- c(individual_bins, grouped_bins)
play_types <- c("pass", "rush")

# Function to create CDF data
create_cdf_object <- function(values) {
  if (length(values) == 0) return(list(values = list(), cdf = list()))
  
  sorted <- sort(values)
  tbl <- table(sorted)
  cdf_vals <- cumsum(tbl) / length(sorted)
  
  list(
    values = as.integer(names(tbl)),
    cdf = round(as.numeric(cdf_vals), 4)  # 4 decimal places
  )
}

# Loop through play types and yardline bins
for (play_type in play_types) {
  for (group in names(yardline_bins)) {
    file_path <- paste0("distr_data/", play_type, "_distributions_yl", group, ".json")
    if (!file.exists(file_path)) {
      print(paste("Skipping missing file:", file_path))
      next
    }

    data <- fromJSON(file_path)
    cdf_data <- list()

    for (key in names(data)) {
      vals <- data[[key]]
      vals <- discard(vals, is.null)
      vals <- vals[!is.na(vals)]

      if (length(vals) >= threshold) {
        cdf_data[[key]] <- create_cdf_object(vals)
      } else {
        cdf_data[[key]] <- list(values = list(), cdf = list())
      }
    }

    # Save CDF file
    dir.create("cdf_data", showWarnings = FALSE)
    output_file <- paste0("cdf_data/", play_type, "_cdf_yl", group, ".json")
    write_json(cdf_data, output_file, pretty = TRUE, auto_unbox = TRUE)

    print(paste("✅ Saved CDF for", play_type, group))
  }
}

print(paste("✅ All CDFs completed with threshold:", threshold))