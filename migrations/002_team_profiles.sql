-- Apply manually before importing/publishing enhanced special-teams profiles.
CREATE TABLE IF NOT EXISTS nflsim.team_profiles (
  year integer, team text, profile_json jsonb NOT NULL,
  PRIMARY KEY (year, team)
);
GRANT ALL ON nflsim.team_profiles TO service_role;
ALTER TABLE nflsim.team_profiles ENABLE ROW LEVEL SECURITY;
