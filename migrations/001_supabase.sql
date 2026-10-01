-- Optional adapter schema. Apply manually only when opting into Supabase.
-- Expose the nflsim schema in the project's Data API settings.
CREATE SCHEMA IF NOT EXISTS nflsim;
CREATE TABLE IF NOT EXISTS nflsim.seasons (
  year integer PRIMARY KEY, manifest jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS nflsim.expected_points (
  year integer, team text, is_defense boolean, down integer, distance integer,
  yardline integer, ep double precision NOT NULL, opt_choice integer NOT NULL,
  PRIMARY KEY (year, team, is_defense, down, distance, yardline)
);
CREATE TABLE IF NOT EXISTS nflsim.coach_decision_probs (
  year integer, team text, is_defense boolean, down integer, distance integer,
  yardline integer, run_prob double precision, pass_prob double precision,
  kick_prob double precision, punt_prob double precision,
  PRIMARY KEY (year, team, is_defense, down, distance, yardline)
);
CREATE TABLE IF NOT EXISTS nflsim.play_cdf (
  year integer, team text, is_defense boolean, down integer, distance integer,
  yardline_bin text, play_type text, values_json jsonb NOT NULL, cdf_json jsonb NOT NULL,
  PRIMARY KEY (year, team, is_defense, down, distance, yardline_bin, play_type)
);
CREATE TABLE IF NOT EXISTS nflsim.special_teams (
  year integer, yardline integer, punt_values jsonb NOT NULL, kick_prob double precision,
  PRIMARY KEY (year, yardline)
);
CREATE TABLE IF NOT EXISTS nflsim.rankings (
  year integer, team text, offense double precision, defense double precision,
  PRIMARY KEY (year, team)
);
GRANT USAGE ON SCHEMA nflsim TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA nflsim TO service_role;
-- Credentials remain server-side; no direct browser access is needed.
ALTER TABLE nflsim.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE nflsim.expected_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE nflsim.coach_decision_probs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nflsim.play_cdf ENABLE ROW LEVEL SECURITY;
ALTER TABLE nflsim.special_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE nflsim.rankings ENABLE ROW LEVEL SECURITY;
