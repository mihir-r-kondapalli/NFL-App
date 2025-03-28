#!/usr/bin/env Rscript

options(repos = c(CRAN = "https://cran.rstudio.com/"))
library(nflfastR)
library(tidyverse)
library(jsonlite)

# ========== 1) LOAD PLAY-BY-PLAY & PREP ==========

pbp_data <- load_pbp(c(2024))

# --- Command-line args: team + threshold ---
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  stop("Usage: Rscript script.R TEAM THRESHOLD")
}
team <- toupper(args[1])
threshold_for_blend <- as.numeric(args[2])

nfl_teams <- c("ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", 
               "DET", "GB", "HOU", "IND", "JAX", "KC", "LV", "LAC", "LAR", "MIA", 
               "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SF", "SEA", "TB", 
               "TEN", "WAS")

if (!(team %in% nfl_teams)) stop(paste("Invalid team abbreviation:", team))

# Convert play_type to 'play_category'
pbp_data <- pbp_data %>%
  mutate(play_category = case_when(
    play_type == "run" & qb_scramble == 0 ~ 0L,
    play_type == "pass" | qb_scramble == 1 ~ 1L,
    play_type == "field_goal"             ~ 2L,
    play_type == "punt"                   ~ 3L,
    TRUE                                  ~ NA_integer_
  )) %>%
  filter(!is.na(play_category))

# ========== 2) NFL-WIDE FALLBACK CDFS ==========

yardlines <- 1:99
all_keys <- expand.grid(down = 1:4, distance = 1:20)
nfl_cdf_map <- list()

for (i in 1:nrow(all_keys)) {
  row <- all_keys[i, ]
  down <- row$down
  dist <- row$distance

  nfl_counts <- pbp_data %>%
    filter(down == down, ydstogo == dist) %>%
    count(play_category) %>%
    complete(play_category = 0:3, fill = list(n = 0)) %>%
    arrange(play_category)

  total_n <- sum(nfl_counts$n)
  if (total_n == 0) {
    nfl_cdf_map[[paste(down, dist, sep = "-")]] <- list(
      values = c(0,1,2,3),
      cdf = c(0,0,0,0)
    )
    next
  }

  nfl_counts <- nfl_counts %>%
    mutate(prob = n / total_n, cdf = cumsum(prob))

  nfl_cdf_map[[paste(down, dist, sep = "-")]] <- list(
    values = nfl_counts$play_category,
    cdf    = nfl_counts$cdf
  )
}

# ========== 2A) HELPERS ==========

cdf_to_probs <- function(cdf_list) {
  cdf <- cdf_list$cdf
  return(c(cdf[1], diff(cdf)))
}

remove_punt_from_cdf <- function(cdf_list) {
  vals <- cdf_list$values
  cdf  <- cdf_list$cdf
  probs <- cdf_to_probs(cdf_list)
  idx_punt <- which(vals == 3)
  if (length(idx_punt) > 0) {
    probs[idx_punt] <- 0
    p_sum <- sum(probs)
    probs <- if (p_sum > 0) probs / p_sum else c(1,0,0,0)
    cdf_list$cdf <- cumsum(probs)
  }
  return(cdf_list)
}

combine_team_league_counts <- function(team_counts, fallback_cdf, threshold) {
  team_n <- sum(team_counts$n)
  if (team_n >= threshold) return(team_counts)

  fallback_probs <- cdf_to_probs(fallback_cdf)
  needed <- threshold - team_n
  extra_vec <- round(needed * fallback_probs)
  new_counts <- team_counts$n + extra_vec
  diff_sum <- (team_n + sum(extra_vec)) - sum(new_counts)
  if (diff_sum != 0) {
    max_idx <- which.max(new_counts)
    new_counts[max_idx] <- new_counts[max_idx] + diff_sum
  }

  tibble(play_category = team_counts$play_category, n = pmax(new_counts, 0))
}

# ========== 3) CDF LOOKUP WITH FALLBACK ==========

cdf_lookup <- list()

for (yardline in yardlines) {
  for (input_down in 1:4) {
    for (distance in 1:20) {
      key <- paste(input_down, distance, yardline, sep = "-")

      # --- Direct team data: yardline ±1
      plays <- pbp_data %>%
        filter(
          down == input_down,
          ydstogo == distance,
          yardline_100 >= yardline - 1, yardline_100 <= yardline + 1,
          posteam == team
        )

      counts <- plays %>%
        count(play_category) %>%
        complete(play_category = 0:3, fill = list(n = 0)) %>%
        arrange(play_category)

      if (yardline <= 30 && input_down != 4) {
        counts$n[counts$play_category == 3] <- 0
      }

      team_n <- sum(counts$n)
      if (team_n > 0) {
        if (team_n < threshold_for_blend) {
          fallback_key <- paste(input_down, distance, sep = "-")
          fallback_cdf <- nfl_cdf_map[[fallback_key]]
          if (yardline <= 30 && input_down != 4) {
            fallback_cdf <- remove_punt_from_cdf(fallback_cdf)
          }
          merged_counts <- combine_team_league_counts(counts, fallback_cdf, threshold_for_blend)
          merged_probs <- merged_counts %>%
            mutate(prob = n / sum(n), cdf = cumsum(prob))
          cdf_lookup[[key]] <- list(values = merged_probs$play_category, cdf = merged_probs$cdf)
        } else {
          counts <- counts %>% mutate(prob = n / team_n, cdf = cumsum(prob))
          cdf_lookup[[key]] <- list(values = counts$play_category, cdf = counts$cdf)
        }
        next
      }

      # --- Interpolation: yardline ±(2:5)
      found <- FALSE
      for (offset in 2:5) {
        plays_interp <- pbp_data %>%
          filter(
            down == input_down,
            ydstogo == distance,
            yardline_100 >= yardline - offset,
            yardline_100 <= yardline + offset,
            posteam == team
          )

        counts_interp <- plays_interp %>%
          count(play_category) %>%
          complete(play_category = 0:3, fill = list(n = 0)) %>%
          arrange(play_category)

        if (yardline <= 30 && input_down != 4) {
          counts_interp$n[counts_interp$play_category == 3] <- 0
        }

        interp_n <- sum(counts_interp$n)
        if (interp_n > 0) {
          if (interp_n < threshold_for_blend) {
            fallback_key <- paste(input_down, distance, sep = "-")
            fallback_cdf <- nfl_cdf_map[[fallback_key]]
            if (yardline <= 30 && input_down != 4) {
              fallback_cdf <- remove_punt_from_cdf(fallback_cdf)
            }
            merged_counts <- combine_team_league_counts(counts_interp, fallback_cdf, threshold_for_blend)
            merged_probs <- merged_counts %>%
              mutate(prob = n / sum(n), cdf = cumsum(prob))
            cdf_lookup[[key]] <- list(values = merged_probs$play_category, cdf = merged_probs$cdf)
          } else {
            counts_interp <- counts_interp %>%
              mutate(prob = n / interp_n, cdf = cumsum(prob))
            cdf_lookup[[key]] <- list(values = counts_interp$play_category, cdf = counts_interp$cdf)
          }
          found <- TRUE
          break
        }
      }

      if (found) next

      # --- Final fallback to NFL data
      fallback_key <- paste(input_down, distance, sep = "-")
      fallback <- nfl_cdf_map[[fallback_key]]
      if (yardline <= 30 && input_down != 4) {
        fallback <- remove_punt_from_cdf(fallback)
      }
      cdf_lookup[[key]] <- fallback

      print(paste(input_down, distance, yardline, sep='-'))
    }
  }
}

# ========== 4) WRITE OUTPUT JSON ==========

dir.create(paste0("biased_eps_", team), showWarnings = FALSE)
output_file <- paste0("biased_eps_", team, "/coach_decision_cdf_", team, ".json")
write_json(cdf_lookup, output_file, pretty = TRUE, auto_unbox = TRUE)

cat(paste0("Coach decision CDF saved to ", output_file, "\n"))
