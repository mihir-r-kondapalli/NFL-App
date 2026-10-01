source(file.path(Sys.getenv("NFLSIM_PIPELINE_DIR"), "common.R"))
library(dplyr)
library(jsonlite)
library(readr)
args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 1) stop("Need explicit season and optional teams")
year <- as.integer(args[1])
teams <- c("NFL", args[-1])
pbp <- load_cached_pbp(year) %>% filter(season_type == "REG")
# Normalize historical/source abbreviations once.
canonical <- function(x) recode(x, LA = "LAR", OAK = "LV", SD = "LAC")
pbp$posteam <- canonical(pbp$posteam)
if (!("defteam" %in% names(pbp))) pbp$defteam <- NA_character_
pbp$defteam <- canonical(pbp$defteam)
for (column in c("fumble_recovery_1_team", "fumbled_1_team")) {
  if (!(column %in% names(pbp))) pbp[[column]] <- NA_character_
  pbp[[column]] <- canonical(pbp[[column]])
}
for (column in c("extra_point_result", "desc")) {
  if (!(column %in% names(pbp))) pbp[[column]] <- NA_character_
}
for (column in c("incomplete_pass", "out_of_bounds")) {
  if (!(column %in% names(pbp))) pbp[[column]] <- NA_real_
}

prior <- 20 # Twenty league-equivalent attempts regularize sparse team samples.
smooth_rate <- function(team_rows, league_rows, made, fallback) {
  league <- if (nrow(league_rows)) mean(made(league_rows), na.rm = TRUE) else fallback
  if (!is.finite(league)) league <- fallback
  successes <- if (nrow(team_rows)) sum(made(team_rows), na.rm = TRUE) else 0
  (successes + prior * league) / (nrow(team_rows) + prior)
}
mixture <- function(team_rows, league_rows, key) {
  n <- nrow(team_rows)
  a <- if (n) n / (n + prior) else 0
  pieces <- list()
  if (n) {
    part <- team_rows %>% count(across(all_of(key)), name = "n")
    part$weight <- a * part$n / sum(part$n)
    pieces[[length(pieces) + 1]] <- part %>% select(all_of(key), weight)
  }
  part <- league_rows %>% count(across(all_of(key)), name = "n")
  part$weight <- (1 - a) * part$n / sum(part$n)
  pieces[[length(pieces) + 1]] <- part %>% select(all_of(key), weight)
  bind_rows(pieces) %>% group_by(across(all_of(key))) %>%
    summarise(weight = sum(weight), .groups = "drop")
}

kicks <- pbp %>% filter(play_type == "field_goal", field_goal_result %in% c("made", "missed", "blocked"), !is.na(yardline_100))
xp <- pbp %>% filter(extra_point_result %in% c("good", "failed", "blocked"))
punts <- pbp %>% filter(play_type == "punt", !is.na(yardline_100), !is.na(kick_distance)) %>%
  mutate(net = as.integer(case_when(
    return_touchdown == 1 ~ -1100,
    # A receiving-team fumble recovered by the kicking team, including a muff.
    !is.na(fumble_recovery_1_team) & fumble_recovery_1_team == posteam &
      ((!is.na(fumbled_1_team) & fumbled_1_team != posteam) | grepl("MUFF", desc, ignore.case = TRUE)) ~
      1100 + kick_distance - coalesce(return_yards, 0),
    touchback == 1 ~ yardline_100,
    TRUE ~ kick_distance - coalesce(return_yards, 0))))
if (!nrow(punts)) stop("No usable punt observations")
kickoffs <- pbp %>% filter(play_type == "kickoff", !is.na(kick_distance)) %>%
  # Onside kicks require a separate model and are deliberately excluded.
  filter(kick_distance >= 30) %>%
  mutate(td = coalesce(return_touchdown == 1, FALSE),
         touchback = coalesce(touchback == 1, FALSE),
         loc = as.integer(case_when(td ~ 0,
           touchback ~ if (year >= 2025) 65 else if (year == 2024) 70 else if (year >= 2016) 75 else 80,
           # Kickoff posteam is the receiver, so the source yardline is measured
           # toward the kicking team's endzone (normally 35, not 65).
           TRUE ~ pmax(1, pmin(99, coalesce(yardline_100, 35) + kick_distance - coalesce(return_yards, 0))))),
         posteam = defteam)
if (!nrow(kickoffs)) {
  kickoffs <- data.frame(posteam = "NFL", loc = if (year >= 2025) 65L else if (year == 2024) 70L else if (year >= 2016) 75L else 80L,
                         td = FALSE, touchback = TRUE)
}
profiles <- list()
for (team in teams) {
  subset_team <- function(rows) if (team == "NFL") rows else rows %>% filter(posteam == team)
  fg <- numeric(99)
  punt_map <- list()
  for (yl in 1:99) {
    nearby <- kicks %>% filter(abs(yardline_100 - yl) <= 5)
    if (!nrow(nearby)) nearby <- kicks
    fg[yl] <- if (yl > 50) 0 else smooth_rate(subset_team(nearby), nearby,
                                             function(x) x$field_goal_result == "made", 0.75)
    nearby <- punts %>% filter(abs(yardline_100 - yl) <= 5)
    if (!nrow(nearby)) nearby <- punts
    nearby$net[nearby$net > -1000 & nearby$net < 1000] <-
      pmin(nearby$net[nearby$net > -1000 & nearby$net < 1000], yl)
    mix <- mixture(subset_team(nearby), nearby, "net")
    punt_map[[as.character(yl)]] <- list(values = as.integer(mix$net), weights = mix$weight)
  }
  ko <- mixture(subset_team(kickoffs), kickoffs, c("loc", "td", "touchback"))
  passes <- pbp %>% filter(play_type == "pass", yards_gained == 0, !is.na(incomplete_pass))
  bounds <- pbp %>% filter(play_type %in% c("run", "pass"), !is.na(out_of_bounds))
  profile <- list(
    fg_probs = fg,
    xp_prob = smooth_rate(subset_team(xp), xp, function(x) x$extra_point_result == "good", 0.945),
    kickoffs = lapply(seq_len(nrow(ko)), function(i) as.list(ko[i, ])),
    punts = punt_map,
    zero_pass_incomplete_prob = smooth_rate(subset_team(passes), passes, function(x) x$incomplete_pass == 1, 0.85),
    out_of_bounds_prob = smooth_rate(subset_team(bounds), bounds, function(x) x$out_of_bounds == 1, 0.12)
  )
  profiles[[team]] <- profile
  directory <- file.path("special-team", team)
  dir.create(directory, recursive = TRUE, showWarnings = FALSE)
  write_csv(data.frame(yardline = 1:99, kick_prob = fg), file.path(directory, "kick_probs.csv"))
  write_json(punt_map, file.path(directory, "punt_net_yards.json"), auto_unbox = FALSE, digits = NA)
  writeLines(as.character(profile$xp_prob), file.path(directory, "xp_prob.txt"))
}
# Scalars are unboxed, but distribution arrays must remain arrays, including singletons.
for (team in teams) {
  profiles[[team]]$fg_probs <- I(profiles[[team]]$fg_probs)
  for (yl in names(profiles[[team]]$punts)) {
    profiles[[team]]$punts[[yl]]$values <- I(profiles[[team]]$punts[[yl]]$values)
    profiles[[team]]$punts[[yl]]$weights <- I(profiles[[team]]$punts[[yl]]$weights)
  }
}
write_json(profiles, "team_profiles.json", auto_unbox = TRUE, digits = NA, na = "null")
