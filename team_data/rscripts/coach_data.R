#!/usr/bin/env Rscript

options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(nflfastR)
library(tidyverse)
library(jsonlite)

# ========== 1) LOAD PLAY-BY-PLAY & PREP ==========

# --- Command-line args: team ---
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript script.R TEAM YEAR")
}
team <- toupper(args[1])
year <- as.numeric(args[2])

pbp_data_team <- load_pbp(c(year))

nfl_teams <- c("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
               "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LA", "MIA", 
               "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
               "TEN", "WAS")
if (!(team %in% nfl_teams)) stop(paste("Invalid team abbreviation:", team))

# NFL fallback cache file
nfl_cache_file <- "cache_data/nfl_fallback_counts.csv"

if (file.exists(nfl_cache_file)) {
  nfl_counts_all <- read_csv(nfl_cache_file, col_types = cols())
} else {
  pbp_data_nfl <- load_pbp(2019:2024) %>%
    filter(game_seconds_remaining >= 300, play_type %in% c("run", "pass", "field_goal", "punt")) %>%
    mutate(play_category = case_when(
      play_type == "run" & qb_scramble == 0 ~ 0L,
      play_type == "pass" | qb_scramble == 1 ~ 1L,
      play_type == "field_goal"             ~ 2L,
      play_type == "punt"                   ~ 3L,
      TRUE                                  ~ NA_integer_
    )) %>%
    filter(!is.na(play_category)) %>%
    count(down, ydstogo, yardline_100, play_category, name = "n") %>%
    pivot_wider(names_from = play_category, values_from = n, values_fill = 0) %>%
    rename(run = `0`, pass = `1`, kick = `2`, punt = `3`) %>%
    mutate(key = paste(down, ydstogo, yardline_100, sep = "-"))
  
  write_csv(pbp_data_nfl, nfl_cache_file)
  nfl_counts_all <- pbp_data_nfl
}

team_counts_all <- pbp_data_team %>%
  filter(game_seconds_remaining >= 300, play_type %in% c("run", "pass", "field_goal", "punt"), posteam == team) %>%
  mutate(play_category = case_when(
    play_type == "run" & qb_scramble == 0 ~ 0L,
    play_type == "pass" | qb_scramble == 1 ~ 1L,
    play_type == "field_goal"             ~ 2L,
    play_type == "punt"                   ~ 3L,
    TRUE                                  ~ NA_integer_
  )) %>%
  filter(!is.na(play_category)) %>%
  count(down, ydstogo, yardline_100, play_category, name = "n") %>%
  pivot_wider(names_from = play_category, values_from = n, values_fill = 0) %>%
  rename(run = `0`, pass = `1`, kick = `2`, punt = `3`) %>%
  mutate(key = paste(down, ydstogo, yardline_100, sep = "-"))

# ========== BUILD PROBABILITIES ==========

all_keys <- expand.grid(down = 1:4, distance = 1:20, yardline = 1:99)
results <- list()

for (i in 1:nrow(all_keys)) {
  row <- all_keys[i, ]
  down <- row$down
  distance <- row$distance
  yardline <- row$yardline
  key <- paste(down, distance, yardline, sep = "-")

  if (distance > yardline) next  # skip physically impossible cases

  probs <- c(0.25, 0.25, 0.25, 0.25)  # default fallback
  num_plays <- 0

  # Force 100% punt rule
  if (down == 4 && distance >= 10 && yardline > 50) {
    probs <- c(0, 0, 0, 1)
    print(paste(key, ": forced punt"))
  } else {
    team_row <- team_counts_all %>% filter(key == !!key)
    fallback_row <- nfl_counts_all %>% filter(key == !!key)

    if (nrow(team_row) > 0) {
      counts <- as.numeric(unlist(team_row[1, c("run", "pass", "kick", "punt")]))
      if (down != 4 || yardline <= 30) counts[4] <- 0
      if (down != 4 || yardline > 50) counts[3] <- 0
      if (sum(counts) > 0) {
        probs <- counts / sum(counts)
        num_plays <- sum(counts)
      }
      print(paste(key, ": team"))
    } else if (nrow(fallback_row) > 0) {
      counts <- as.numeric(unlist(fallback_row[1, c("run", "pass", "kick", "punt")]))
      if (down != 4 || yardline <= 30) counts[4] <- 0
      if (down != 4 || yardline > 50) counts[3] <- 0
      if (sum(counts) > 0) {
        probs <- counts / sum(counts)
        num_plays <- sum(counts)
      }
      print(paste(key, ": nfl"))
    } else {
      if (down == 4) {
        if (yardline <= 35) {
          probs <- c(0, 0, 1, 0)
        } else {
          probs <- c(0, 0, 0, 1)
        }
      } else {
        probs <- c(0.5, 0.5, 0, 0)
      }
      print(paste(key, ": default"))
    }
  }

  # Always assign the result
  results[[key]] <- c(down, distance, yardline, round(probs, 4), num_plays)
}

# ========== WRITE TO CSV ==========

results_df <- do.call(rbind, results) %>%
  as.data.frame()
colnames(results_df) <- c("down", "distance", "yardline", "run", "pass", "kick", "punt", "num_plays")

output_csv <- paste0("team-data/", team, "/coach_decision_probs_", team, ".csv")
write_csv(results_df, output_csv)

cat(paste0("CSV file saved to ", output_csv, "\n"))
