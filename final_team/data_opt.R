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

# --- Helpers ---
blend_team_league_with_interpolation <- function(
  team_distributions, league_distributions, key, all_keys,
  threshold = 20, shrinkage = 40, depth = 0, max_depth = 2
) {
  parts <- strsplit(key, "-")[[1]]
  down <- as.integer(parts[1])
  distance <- as.integer(parts[2])

  team_vec <- team_distributions[[key]]
  league_vec <- league_distributions[[key]]

  n_team <- length(team_vec)
  n_league <- length(league_vec)

  if (n_team >= threshold || n_league >= threshold) {
    w_team <- n_team / (n_team + shrinkage)
    w_league <- 1 - w_team
    n_team_sample <- round(threshold * w_team)
    n_league_sample <- threshold - n_team_sample
    return(as.integer(c(
      sample(team_vec, n_team_sample, replace = TRUE),
      sample(league_vec, n_league_sample, replace = TRUE)
    )))
  }

  if (depth >= max_depth) {
    if (n_team > 0) return(as.integer(sample(team_vec, threshold, replace = TRUE)))
    if (n_league > 0) return(as.integer(sample(league_vec, threshold, replace = TRUE)))
    return(rep(0L, threshold))
  }

  neighbor_keys <- paste0(down, "-", c(distance - 2, distance - 1, distance + 1, distance + 2))
  neighbor_keys <- neighbor_keys[neighbor_keys %in% all_keys$key]

  neighbor_samples <- unlist(lapply(neighbor_keys, function(nk) {
    blend_team_league_with_interpolation(
      team_distributions, league_distributions, nk, all_keys,
      threshold, shrinkage, depth + 1, max_depth
    )
  }), use.names = FALSE)

  if (length(neighbor_samples) >= threshold) {
    return(as.integer(sample(neighbor_samples, threshold, replace = TRUE)))
  }

  if (n_team > 0) return(as.integer(sample(team_vec, threshold, replace = TRUE)))
  if (n_league > 0) return(as.integer(sample(league_vec, threshold, replace = TRUE)))
  return(rep(0L, threshold))
}

# --- Load or cache processed data ---
cache_file <- "cache_data/pbp_processed_2024.rds"
if (file.exists(cache_file)) {
  pbp_data <- readRDS(cache_file)
} else {
  pbp_data <- load_pbp(c(2024)) %>%
    filter(
      game_seconds_remaining >= 300,
      season_type == "REG",
      play_type %in% c("run", "pass"),
      !is.na(yards_gained)
    ) %>%
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
    select(
      posteam, down, ydstogo, yardline_100,
      is_run, is_pass, adj_yards
    )

  dir.create("cache_data", showWarnings = FALSE)
  saveRDS(pbp_data, cache_file)
}

team_pbp_data <- pbp_data %>% filter(posteam == team)

# --- Yardline binning ---
individual_bins <- setNames(as.list(1:20), as.character(1:20))
grouped_bins <- list(
  "21-23" = 21:23, "24-27" = 24:27, "28-32" = 28:32,
  "33-38" = 33:38, "39-44" = 39:44, "45-50" = 45:50,
  "51-70" = 51:70, "71-85" = 71:85, "86-99" = 86:99
)
yardline_bins <- c(individual_bins, grouped_bins)

all_keys <- expand.grid(down = 1:4, distance = 1:20) %>%
  mutate(key = paste(down, distance, sep = "-"))

# --- Loop over yardline bins ---
for (yardline_range in names(yardline_bins)) {
  lower_yl <- min(yardline_bins[[yardline_range]])
  upper_yl <- max(yardline_bins[[yardline_range]])

  rush_distributions <- list()
  pass_distributions <- list()
  team_rush_map <- list()
  team_pass_map <- list()
  league_rush_map <- list()
  league_pass_map <- list()

  for (input_down in 1:4) {
    for (yards in 1:20) {
      key <- paste(input_down, yards, sep = "-")

      rush_team <- team_pbp_data %>%
        filter(is_run, down == input_down, ydstogo == yards,
               yardline_100 >= lower_yl, yardline_100 <= upper_yl) %>%
        pull(adj_yards)

      pass_team <- team_pbp_data %>%
        filter(is_pass, down == input_down, ydstogo == yards,
               yardline_100 >= lower_yl, yardline_100 <= upper_yl) %>%
        pull(adj_yards)

      rush_lg <- pbp_data %>%
        filter(is_run, down == input_down, ydstogo == yards,
               yardline_100 >= lower_yl, yardline_100 <= upper_yl) %>%
        pull(adj_yards)

      pass_lg <- pbp_data %>%
        filter(is_pass, down == input_down, ydstogo == yards,
               yardline_100 >= lower_yl, yardline_100 <= upper_yl) %>%
        pull(adj_yards)

      team_rush_map[[key]] <- rush_team
      team_pass_map[[key]] <- pass_team
      league_rush_map[[key]] <- rush_lg
      league_pass_map[[key]] <- pass_lg
    }
  }

  for (key in all_keys$key) {
    rush_distributions[[key]] <- blend_team_league_with_interpolation(
      team_rush_map, league_rush_map, key, all_keys, threshold
    )
    pass_distributions[[key]] <- blend_team_league_with_interpolation(
      team_pass_map, league_pass_map, key, all_keys, threshold
    )
  }

  dir.create("distr_data", showWarnings = FALSE)
  rush_file <- paste0("distr_data/rush_distributions_yl", yardline_range, ".json")
  pass_file <- paste0("distr_data/pass_distributions_yl", yardline_range, ".json")

  write_json(rush_distributions, rush_file, pretty = TRUE, auto_unbox = TRUE)
  write_json(pass_distributions, pass_file, pretty = TRUE, auto_unbox = TRUE)
}

print("✅ Distributions saved with team + league blending and neighbor interpolation!")
