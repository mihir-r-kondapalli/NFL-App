# Load necessary libraries
options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(nflfastR)
library(tidyverse)

# Load play-by-play data for the 2024 season
pbp_data <- load_pbp(c(2018, 2019, 2021, 2022, 2023, 2024))

# Define yardlines (1-99)
yardlines <- 1:99

# Initialize an empty list for storing results
play_decisions_list <- list()

# Loop through each yardline
for (yardline in yardlines) {
  
  # Loop through all down & distance combinations
  for (input_down in 1:4) {
    for (yards in 1:20) {
      
      # Filter play data for this team, down, distance, and yardline **(FIXED FILTERS)**
      play_data <- pbp_data %>%
        filter(
          down == input_down,
          ydstogo == yards,
          yardline_100 >= (yardline - 1), yardline_100 <= (yardline + 1),  # Allow small range
        )
      
      # Count occurrences of each play type
      play_counts <- play_data %>%
        mutate(play_category = case_when(
          play_type == "run" & qb_scramble == 0 ~ 0,  # Run (No scramble)
          play_type == "pass" | qb_scramble == 1 ~ 1, # Pass (including scramble)
          play_type == "field_goal" ~ 2,              # Kick (Field Goal)
          play_type == "punt" ~ 3,                    # Punt
          TRUE ~ NA_real_
        )) %>%
        filter(!is.na(play_category)) %>%
        count(play_category)
      
      # Determine the most common play call
      best_play <- ifelse(nrow(play_counts) > 0, 
                          as.integer(play_counts %>% arrange(desc(n)) %>% slice(1) %>% pull(play_category)), 
                          NA_integer_)

      # Append to list
      play_decisions_list[[length(play_decisions_list) + 1]] <- data.frame(
        Down = input_down,
        Distance = yards,
        Yardline = yardline,
        Play_Choice = best_play  # NA if no occurrences
      )

      print(paste("Down:", input_down, "- Distance:", yards, "- Yardline:", yardline, "- Play:", best_play))
    }
  }
}

# Convert list to DataFrame
play_decisions_df <- bind_rows(play_decisions_list)

# Save as CSV with correct column names
output_filename <- paste0("coach_play_decisions_nfl.csv")
write.csv(play_decisions_df, output_filename, row.names = FALSE, na = "NA")

print(paste("Lookup table saved as", output_filename, "!"))