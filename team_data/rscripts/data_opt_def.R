# Load necessary libraries
options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(nflfastR)
library(tidyverse)
library(jsonlite)

# --- Command line argument: team + threshold ---
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2){
  print("Need team and threshold")
  quit(save = "no")
}

team <- args[1]
threshold <- as.numeric(args[2])

# --- Updated Blending Function with 70/30 logic ---
blend_distributions <- function(team_data, league_data, key, all_keys, threshold, final_sample_size = 20) {
  parts <- strsplit(key, "-")[[1]]
  down <- as.integer(parts[1])
  distance <- as.integer(parts[2])

  team_vec <- team_data[[key]]
  league_vec <- league_data[[key]]

  n_team <- length(team_vec)

  if (n_team >= threshold) {
    return(as.integer(team_vec))
  }

  n_team_sample <- min(final_sample_size, round(final_sample_size * 0.4))
  n_other_sample <- final_sample_size - n_team_sample

  sampled_team <- if (n_team > 0) sample(team_vec, n_team_sample, replace = (n_team < n_team_sample)) else integer()

  league_and_neighbors <- league_vec
  if (length(league_and_neighbors) < n_other_sample) {
    neighbors <- find_neighbor_keys(down, distance, all_keys)
    for (nkey in neighbors) {
      if (length(league_and_neighbors) >= n_other_sample) break
      neighbor_league_data <- league_data[[nkey]]
      if (length(neighbor_league_data) > 0) {
        needed <- n_other_sample - length(league_and_neighbors)
        league_and_neighbors <- c(league_and_neighbors, sample(neighbor_league_data, min(needed, length(neighbor_league_data)), replace = TRUE))
      }
    }
  }

  if (length(league_and_neighbors) > 0) {
    sampled_other <- sample(league_and_neighbors, n_other_sample, replace = (length(league_and_neighbors) < n_other_sample))
  } else {
    sampled_other <- rep(0L, n_other_sample)
  }

  return(as.integer(c(sampled_team, sampled_other)))
}

find_neighbor_keys <- function(down, distance, all_keys) {
  same_down_neighbors <- paste0(down, "-", c(distance - 1, distance + 1, distance - 2, distance + 2, distance - 3, distance + 3))
  similar_down_neighbors <- c()
  if (down %in% c(1, 2, 3)) {
    similar_down_neighbors <- paste0(c(down + 1, down - 1), "-", distance)
    similar_down_neighbors <- similar_down_neighbors[grepl("^[1-4]-", similar_down_neighbors)]
  }
  mixed_neighbors <- c()
  if (down %in% c(1, 2, 3)) {
    close_downs <- c(down - 1, down + 1)
    close_downs <- close_downs[close_downs %in% 1:4]
    close_distances <- c(distance - 1, distance + 1)
    close_distances <- close_distances[close_distances %in% 1:20]
    for (d in close_downs) {
      for (yd in close_distances) {
        mixed_neighbors <- c(mixed_neighbors, paste0(d, "-", yd))
      }
    }
  }
  all_neighbors <- c(same_down_neighbors, similar_down_neighbors, mixed_neighbors)
  return(all_neighbors[all_neighbors %in% all_keys$key])
}

# --- Load or cache processed data ---
cache_file <- "cache_data/pbp_processed_2024_def.rds"
if (file.exists(cache_file)) {
  pbp_data <- readRDS(cache_file)
} else {
  pbp_data <- load_pbp(c(2024)) %>%
    filter(game_seconds_remaining >= 300, season_type == "REG", play_type %in% c("run", "pass"), !is.na(yards_gained)) %>%
    mutate(
      is_run = play_type == "run" & qb_scramble == 0,
      is_pass = play_type == "pass" | qb_scramble == 1,
      is_touchdown = rush_touchdown == 1 | pass_touchdown == 1,
      is_fumble = fumble_lost == 1,
      is_interception = interception == 1,
      adj_yards = case_when(
        is_fumble ~ -1100 - return_yards + yards_gained,
        is_interception ~ -2100 - return_yards + air_yards,
        is_touchdown ~ 10 + yards_gained,
        TRUE ~ yards_gained
      )
    ) %>%
    select(defteam, down, ydstogo, yardline_100, is_run, is_pass, adj_yards)

  dir.create("cache_data", showWarnings = FALSE)
  saveRDS(pbp_data, cache_file)
}

team_pbp_data <- pbp_data %>% filter(defteam == team)

individual_bins <- setNames(as.list(1:20), as.character(1:20))
grouped_bins <- list(
  "21-23" = 21:23, "24-27" = 24:27, "28-32" = 28:32,
  "33-38" = 33:38, "39-44" = 39:44, "45-50" = 45:50,
  "51-70" = 51:70, "71-85" = 71:85, "86-99" = 86:99
)
yardline_bins <- c(individual_bins, grouped_bins)

all_keys <- expand.grid(down = 1:4, distance = 1:20) %>% mutate(key = paste(down, distance, sep = "-"))

total_bins <- length(yardline_bins)
bin_counter <- 0

for (yardline_range in names(yardline_bins)) {
  bin_counter <- bin_counter + 1
  cat(sprintf("Processing bin %d of %d: %s\n", bin_counter, total_bins, yardline_range))
  lower_yl <- min(yardline_bins[[yardline_range]])
  upper_yl <- max(yardline_bins[[yardline_range]])

  team_rush_map <- team_pass_map <- league_rush_map <- league_pass_map <- setNames(vector("list", length(all_keys$key)), all_keys$key)
  filtered_team_data <- team_pbp_data %>% filter(yardline_100 >= lower_yl, yardline_100 <= upper_yl)
  filtered_league_data <- pbp_data %>% filter(yardline_100 >= lower_yl, yardline_100 <= upper_yl)

  for (key_idx in 1:nrow(all_keys)) {
    down_val <- all_keys$down[key_idx]
    ydstogo_val <- all_keys$distance[key_idx]
    key <- all_keys$key[key_idx]
    team_rush_map[[key]] <- filtered_team_data %>% filter(is_run, down == down_val, ydstogo == ydstogo_val) %>% pull(adj_yards)
    team_pass_map[[key]] <- filtered_team_data %>% filter(is_pass, down == down_val, ydstogo == ydstogo_val) %>% pull(adj_yards)
    league_rush_map[[key]] <- filtered_league_data %>% filter(is_run, down == down_val, ydstogo == ydstogo_val) %>% pull(adj_yards)
    league_pass_map[[key]] <- filtered_league_data %>% filter(is_pass, down == down_val, ydstogo == ydstogo_val) %>% pull(adj_yards)
  }

  rush_distributions <- pass_distributions <- setNames(vector("list", length(all_keys$key)), all_keys$key)

  for (key in all_keys$key) {
    rush_distributions[[key]] <- blend_distributions(team_rush_map, league_rush_map, key, all_keys, threshold)
    pass_distributions[[key]] <- blend_distributions(team_pass_map, league_pass_map, key, all_keys, threshold)
  }

  dir.create("distr_data", showWarnings = FALSE)
  rush_file <- paste0("distr_data/rush_distributions_yl", yardline_range, ".json")
  pass_file <- paste0("distr_data/pass_distributions_yl", yardline_range, ".json")

  write_json(rush_distributions, rush_file, pretty = TRUE, auto_unbox = TRUE)
  write_json(pass_distributions, pass_file, pretty = TRUE, auto_unbox = TRUE)

  cat(sprintf("Completed bin %s\n", yardline_range))
}

print("✅ Distributions saved successfully!")
print(paste("Team:", team, "| Threshold:", threshold))
print(paste("Total yardline bins processed:", length(yardline_bins)))
