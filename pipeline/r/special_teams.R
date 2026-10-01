source(file.path(Sys.getenv("NFLSIM_PIPELINE_DIR"), "common.R"))
library(nflfastR)
library(dplyr)
library(jsonlite)
library(readr)
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1) stop("Need explicit season")
year <- as.integer(args[1])
pbp <- load_cached_pbp(year) %>% filter(season_type == "REG")
if (all(c("posteam", "fumbled_1_team", "fumble_recovery_1_team") %in% names(pbp))) {
  pbp$retained_muff <- !is.na(pbp$fumble_recovery_1_team) &
    pbp$fumble_recovery_1_team == pbp$posteam &
    ((!is.na(pbp$fumbled_1_team) & pbp$fumbled_1_team != pbp$posteam) |
     if ("desc" %in% names(pbp)) grepl("MUFF", pbp$desc, ignore.case = TRUE) else FALSE)
} else {
  # Compatibility for older synthetic/raw schemas lacking recovery-team fields.
  pbp$retained_muff <- pbp$fumble_lost == 1
}
punts <- pbp %>% filter(play_type == "punt", !is.na(yardline_100), !is.na(kick_distance)) %>%
  mutate(net = case_when(
    return_touchdown == 1 ~ -1100,
    retained_muff ~ 1100 + kick_distance - coalesce(return_yards, 0),
    touchback == 1 ~ yardline_100,
    TRUE ~ kick_distance - coalesce(return_yards, 0)))
if (!nrow(punts)) stop("Season has no usable punt data")
kicks <- pbp %>% filter(play_type == "field_goal", field_goal_result %in% c("made", "missed"), !is.na(yardline_100))
if (!nrow(kicks)) stop("Season has no usable field goal data")
punt_data <- list()
kick_data <- numeric(99)
for (yl in 1:99) {
  # Pool neighboring yardlines for sparse observations; clamp normal punts to the endzone.
  nearest_punts <- punts %>% filter(abs(yardline_100 - yl) <= 5)
  if (!nrow(nearest_punts)) nearest_punts <- punts
  vals <- as.integer(nearest_punts$net)
  vals[vals > -1000 & vals < 1000] <- pmin(vals[vals > -1000 & vals < 1000], yl)
  punt_data[[as.character(yl)]] <- vals
  nearest_kicks <- kicks %>% filter(abs(yardline_100 - yl) <= 5)
  kick_data[yl] <- if (yl > 50) 0 else if (nrow(nearest_kicks)) mean(nearest_kicks$field_goal_result == "made") else mean(kicks$field_goal_result == "made")
}
write_json(punt_data, "punt_net_yards.json", auto_unbox = FALSE)
write_csv(data.frame(yardline = 1:99, kick_prob = kick_data), "kick_probs.csv")
# Season-specific weights reproduce the notebook's weighted AEP calculation.
frequency <- pbp %>% filter(play_type %in% c("run", "pass"), down == 1,
                            !is.na(ydstogo), yardline_100 >= 1, yardline_100 <= 99) %>%
  count(down, ydstogo, yardline_100, name = "frequency") %>%
  rename(distance = ydstogo, yardline = yardline_100)
write_csv(frequency, "frequency.csv")
