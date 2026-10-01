# Verify preparation package versions against the committed lock; no auto-install.
lock_file <- file.path(Sys.getenv("NFLSIM_PIPELINE_DIR"), "..", "renv.lock")
if (!requireNamespace("jsonlite", quietly = TRUE)) stop("Run make setup-r before generating data")
lock <- jsonlite::fromJSON(lock_file, simplifyVector = FALSE)
versions <- installed.packages()[, "Version"]
for (name in names(lock$Packages)) {
  version <- lock$Packages[[name]]$Version
  if (!(name %in% names(versions)) || versions[[name]] != version)
    stop(paste("R dependency mismatch:", name, "expected", version, "- run make setup-r"))
}


# All stochastic preparation uses the CLI seed and one immutable raw cache per season.
set.seed(as.integer(Sys.getenv("NFLSIM_SEED", "25")))
load_cached_pbp <- function(seasons) {
  if (length(seasons) != 1) stop("Build one explicitly selected season at a time")
  cache_dir <- Sys.getenv("NFLSIM_RAW_DIR")
  if (!nzchar(cache_dir)) stop("Run data preparation through nflsim data build")
  dir.create(cache_dir, recursive = TRUE, showWarnings = FALSE)
  cache <- file.path(cache_dir, paste0("pbp_", seasons, ".rds"))
  if (file.exists(cache)) return(readRDS(cache))
  if (Sys.getenv("NFLSIM_OFFLINE") == "1") stop("Cached raw season missing; offline preparation cannot download")
  pbp <- nflfastR::load_pbp(seasons)
  if (!nrow(pbp)) stop("No play-by-play records found for this season")
  saveRDS(pbp, cache)
  pbp
}
