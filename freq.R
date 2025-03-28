library(nflfastR)
library(dplyr)
library(readr)

# Load play-by-play data for recent seasons (e.g. 2021–2023)
seasons <- 2021:2023
pbp <- purrr::map_df(seasons, load_pbp)

# Filter for valid downs (1 to 4), valid distances, and yardline between 1 and 99
filtered <- pbp %>%
  filter(!is.na(down), !is.na(ydstogo), !is.na(yardline_100),
         down >= 1, down <= 4,
         ydstogo >= 1, ydstogo <= 100,
         yardline_100 >= 1, yardline_100 <= 99)

# Group and count frequency
frequency_df <- filtered %>%
  group_by(down, ydstogo, yardline_100) %>%
  summarise(frequency = n(), .groups = "drop") %>%
  rename(distance = ydstogo, yardline = yardline_100)

# Save to CSV
write_csv(frequency_df, "frequency.csv")

cat("✅ Saved: down_distance_yardline_frequency.csv\n")
