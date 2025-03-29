#!/usr/bin/env Rscript

options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(nflfastR)
library(tidyverse)
library(jsonlite)

# ========== 1) LOAD PLAY-BY-PLAY & PREP ==========

pbp_data_team <- load_pbp(c(2024))
pbp_data_nfl <- load_pbp(2019:2024)

# --- Command-line args: team + threshold ---
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) {
  stop("Usage: Rscript script.R TEAM")
}
team <- toupper(args[1])

nfl_teams <- c("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
               "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
               "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
               "TEN", "WAS")

if (!(team %in% nfl_teams)) stop(paste("Invalid team abbreviation:", team))

# Convert play_type to 'play_category'
pbp_data_team <- pbp_data_team %>%
  filter(game_seconds_remaining >= 300, play_type %in% c("run", "pass", "field_goal", "punt"),
        (play_type == "punt" | play_type == "field_goal") & special_teams_play == TRUE & posteam == team) %>%
  mutate(play_category = case_when(
    play_type == "run" & qb_scramble == 0 ~ 0L,
    play_type == "pass" | qb_scramble == 1 ~ 1L,
    play_type == "field_goal"             ~ 2L,
    play_type == "punt"                   ~ 3L,
    TRUE                                  ~ NA_integer_
  )) %>%
  filter(!is.na(play_category))

pbp_data_nfl <- pbp_data_nfl %>%
  filter(game_seconds_remaining >= 300, play_type %in% c("run", "pass", "field_goal", "punt"),
        (play_type == "punt" | play_type == "field_goal") & special_teams_play == TRUE) %>%
  mutate(play_category = case_when(
    play_type == "run" & qb_scramble == 0 ~ 0L,
    play_type == "pass" | qb_scramble == 1 ~ 1L,
    TRUE                                  ~ NA_integer_
  )) %>%
  filter(!is.na(play_category))

# ========== HELPERS ========== 

cdf_to_probs <- function(cdf) {
  return(c(cdf[1], diff(cdf)))
}

remove_punt_probs <- function(probs) {
  probs[4] <- 0
  total <- sum(probs)
  if (total == 0) return(c(1, 0, 0, 0))
  return(probs / total)
}

remove_fg_probs <- function(probs) {
  probs[3] <- 0
  total <- sum(probs)
  if (total == 0) return(c(1, 0, 0, 0))
  return(probs / total)
}

# ========== BUILD PROBABILITIES ==========

all_keys <- expand.grid(down = 1:4, distance = 1:20, yardline = 1:99)
results <- list()

for (i in 1:nrow(all_keys)) {
  row <- all_keys[i, ]
  down <- row$down
  distance <- row$distance
  yardline <- row$yardline
  key <- paste(down, distance, yardline, sep = "-")

  # Force 100% punt rule
  if (down == 4 && distance >= 10 && yardline > 50) {
    results[[key]] <- c(down, distance, yardline, 0, 0, 0, 1)
    next
  }

  team_plays <- pbp_data_team %>%
    filter(
      down == down,
      ydstogo == distance,
      yardline_100 == yardline,
    )

  counts <- team_plays %>%
    count(play_category) %>%
    complete(play_category = 0:3, fill = list(n = 0)) %>%
    arrange(play_category)

  if (down != 4 || yardline <= 30) {
    counts$n[4] <- 0
  }
  if (down != 4 || yardline > 50) {
    counts$n[3] <- 0
  }

  team_n <- sum(counts$n)

  nfl_plays <- pbp_data_nfl %>%
    filter(
      down == down,
      ydstogo == distance,
      yardline_100 == yardline,
    )

  fallback_counts <- team_plays %>%
    count(play_category) %>%
    complete(play_category = 0:3, fill = list(n = 0)) %>%
    arrange(play_category)

  if (down != 4 || yardline <= 30) {
    fallback_counts$n[4] <- 0
  }
  if (down != 4 || yardline > 50) {
    fallback_counts$n[3] <- 0
  }

  fallback_n <- sum(fallback_counts$n)
  fallback_probs <- c(0.1, 0.1, 0.1, 0.7)
  if (fallback_n > 0) {
    fallback_probs <- fallback_counts$n / fallback_n
  }

  if (team_n >= 0) {
    probs <- counts$n / team_n
  } else {
    probs <- fallback_probs
  }

  results[[key]] <- c(down, distance, yardline, round(probs, 4))

  print(paste(down, distance, yardline, sep='-'))
}

# ========== WRITE TO CSV ==========

results_df <- do.call(rbind, results) %>%
  as.data.frame()
colnames(results_df) <- c("down", "distance", "yardline", "run", "pass", "kick", "punt")

output_csv <- paste0("biased_eps_", team, "/coach_decision_probs_", team, ".csv")
dir.create(paste0("biased_eps_", team), showWarnings = FALSE)
write_csv(results_df, output_csv)

cat(paste0("CSV file saved to ", output_csv, "\n"))
