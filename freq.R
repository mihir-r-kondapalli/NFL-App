library(nflfastR)
library(dplyr)
library(readr)

# Load play-by-play data for recent seasons (e.g. 2021–2023)
seasons <- 2021:2023
pbp <- purrr::map_df(seasons, load_pbp)

# Filter out missing values and invalid yardlines
filtered_drives <- pbp %>%
  filter(!is.na(drive), !is.na(drive_play_id_started), !is.na(yardline_100)) %>%
  filter(!play_type %in% c("kickoff", "extra_point", "field_goal", "punt")) %>%  # remove non-offensive plays
  group_by(game_id, drive) %>%
  filter(play_id == min(play_id)) %>%
  ungroup() %>%
  filter(yardline_100 >= 1, yardline_100 <= 99)

# Count how many drives started at each yardline
drive_starts <- filtered_drives %>%
  count(yardline_100, name = "drive_count") %>%
  rename(yardline = yardline_100)

# Save to CSV
write_csv(drive_starts, "drive_start_counts.csv")

cat("Saved: drive_start_counts.csv\n")
