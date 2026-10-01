"""Postseason qualification and reseeded brackets from simulated regular-season scores.

Net-touchdown tiebreakers are unavailable; a stable seeded draw resolves that final
step. All preceding score-based criteria are calculated from regular-season games.
"""

import hashlib
from fractions import Fraction

from .models import SimulationRequest

DIVISIONS = {
    "AFC East": "BUF MIA NE NYJ",
    "AFC North": "BAL CIN CLE PIT",
    "AFC South": "HOU IND JAX TEN",
    "AFC West": "DEN KC LAC LV",
    "NFC East": "DAL NYG PHI WAS",
    "NFC North": "CHI DET GB MIN",
    "NFC South": "ATL CAR NO TB",
    "NFC West": "ARI LAR SEA SF",
}
DIVISION = {team: division for division, teams in DIVISIONS.items() for team in teams.split()}


def stable_seed(season, seed, label):
    return int.from_bytes(hashlib.sha256(f"{season}:{seed}:{label}".encode()).digest()[:8], "big")


class Qualification:
    def __init__(self, games, season, seed):
        self.season, self.seed = season, seed
        self.records = {team: [] for team in DIVISION}
        for g in games:
            h, a = g["home_team"], g["away_team"]
            hs, aws = g["home_score"], g["away_score"]
            self.records[h].append((a, hs, aws))
            self.records[a].append((h, aws, hs))

    def rows(self, team, opponents=None):
        return [r for r in self.records[team] if opponents is None or r[0] in opponents]

    @staticmethod
    def pct(rows):
        return (
            Fraction(sum(2 if s > a else 1 if s == a else 0 for _, s, a in rows), 2 * len(rows))
            if rows
            else Fraction(0)
        )

    def strength(self, team, victory=False):
        rows = [
            r
            for opponent, s, a in self.records[team]
            if not victory or s > a
            for r in self.records[opponent]
        ]
        return self.pct(rows)

    def rank_points(self, team, pool):
        totals = {
            t: (sum(s for _, s, _ in self.records[t]), sum(a for _, _, a in self.records[t]))
            for t in pool
        }
        scored, allowed = totals[team]
        return -(
            sum(s > scored for s, _ in totals.values())
            + sum(a < allowed for _, a in totals.values())
        )

    def winner(self, teams, division=False):
        teams = list(teams)
        best = max(self.pct(self.records[t]) for t in teams)
        tied = [t for t in teams if self.pct(self.records[t]) == best]
        if len(tied) == 1:
            return tied[0]
        if not division:
            groups = {}
            for t in tied:
                groups.setdefault(DIVISION[t], []).append(t)
            tied = [self.winner(group, True) for group in groups.values()]
            if len(tied) == 1:
                return tied[0]
        conference = {t for t in DIVISION if DIVISION[t][:3] == DIVISION[tied[0]][:3]}
        common = set.intersection(*(set(r[0] for r in self.records[t]) for t in tied))
        criteria = []
        if division or len(tied) == 2:
            if all(self.rows(t, set(tied) - {t}) for t in tied):
                criteria.append(lambda t: self.pct(self.rows(t, set(tied) - {t})))
        else:

            def sweep(t):
                rows = self.rows(t, set(tied) - {t})
                if {r[0] for r in rows} != set(tied) - {t}:
                    return 0
                return (
                    1
                    if all(s > a for _, s, a in rows)
                    else (-1 if all(s < a for _, s, a in rows) else 0)
                )

            criteria.append(sweep)
        division_teams = {t for t in DIVISION if DIVISION[t] == DIVISION[tied[0]]}
        if division:
            criteria.append(lambda t: self.pct(self.rows(t, division_teams)))
            criteria.append(lambda t: self.pct(self.rows(t, common)))
        criteria.append(lambda t: self.pct(self.rows(t, conference)))
        if not division and all(len(self.rows(t, common)) >= 4 for t in tied):
            criteria.append(lambda t: self.pct(self.rows(t, common)))
        criteria.extend(
            [
                lambda t: self.strength(t, True),
                lambda t: self.strength(t),
                lambda t: self.rank_points(t, conference),
                lambda t: self.rank_points(t, DIVISION),
                lambda t: sum(
                    s - a for _, s, a in self.rows(t, common if division else conference)
                ),
                lambda t: sum(s - a for _, s, a in self.records[t]),
                lambda t: stable_seed(self.season, self.seed, "tiebreak:" + t),
            ]
        )
        for criterion in criteria:
            values = {t: criterion(t) for t in tied}
            best = max(values.values())
            remaining = [t for t in tied if values[t] == best]
            if len(remaining) < len(tied):
                return self.winner(remaining, division)
        return sorted(tied)[0]  # SHA-256 prefix collision only.

    def ordered(self, teams):
        remaining, result = list(teams), []
        while remaining:
            chosen = self.winner(remaining)
            result.append(chosen)
            remaining.remove(chosen)
        return result

    def seeds(self):
        result = {}
        for conference in ("AFC", "NFC"):
            divisions = [
                teams.split() for name, teams in DIVISIONS.items() if name.startswith(conference)
            ]
            division_orders = [self.ordered(teams) for teams in divisions]
            winners = [order[0] for order in division_orders]
            remaining = [order[1:] for order in division_orders]
            wildcards = []
            for _ in range(3 if self.season >= 2020 else 2):
                chosen = self.winner([order[0] for order in remaining if order])
                wildcards.append(chosen)
                for order in remaining:
                    if order and order[0] == chosen:
                        order.pop(0)
                        break
            qualified = self.ordered(winners) + wildcards
            result[conference] = [
                dict(team=t, seed=i + 1, division=DIVISION[t], division_winner=t in winners)
                for i, t in enumerate(qualified)
            ]
        return result


def simulate_playoffs(engine, regular, progress=None):
    if not regular["complete"]:
        raise ValueError("Playoffs require a complete regular season; omit --team and --week")
    season, seed = regular["season"], regular["seed"]
    seeds = Qualification(regular["games"], season, seed).seeds()
    games = []
    total = 13 if season >= 2020 else 11

    def play(home, away, round_name, conference):
        game_id = f"{season}_{round_name}_{conference}_{away['team']}_{home['team']}"
        game_seed = stable_seed(season, seed, game_id)
        result = engine.simulate(
            SimulationRequest(
                team1=home["team"],
                team2=away["team"],
                year1=season,
                year2=season,
                seed=game_seed,
                postseason=True,
                include_drives=True,
            )
        )
        hs, aws = result["team1_scores"][0], result["team2_scores"][0]
        if hs == aws:
            raise RuntimeError("Postseason engine returned a tied game")
        winner = home if hs > aws else away
        game = dict(
            game_id=game_id,
            season=season,
            game_type=round_name,
            conference=conference,
            home_team=home["team"],
            away_team=away["team"],
            home_seed=home["seed"],
            away_seed=away["seed"],
            home_score=hs,
            away_score=aws,
            winner=winner["team"],
            seed=game_seed,
            plays=result["play_counts"][0],
            overtime=result["overtime"][0],
            drives=result.get("drives", [None])[0],
            location="Neutral" if round_name == "SB" else "Home",
        )
        games.append(game)
        if progress:
            progress(len(games), total, game)
        return winner

    champions = {}
    for conference, entries in seeds.items():
        byes = 1 if season >= 2020 else 2
        survivors = entries[:byes]
        playing = entries[byes:]
        survivors += [
            play(playing[i], playing[-i - 1], "WC", conference) for i in range(len(playing) // 2)
        ]
        survivors.sort(key=lambda t: t["seed"])
        finalists = [
            play(survivors[0], survivors[3], "DIV", conference),
            play(survivors[1], survivors[2], "DIV", conference),
        ]
        finalists.sort(key=lambda t: t["seed"])
        champions[conference] = play(*finalists, "CON", conference)
    champion = play(champions["AFC"], champions["NFC"], "SB", "NFL")
    return dict(
        seeds=seeds,
        games=games,
        champion=champion["team"],
        conference_champions={c: t["team"] for c, t in champions.items()},
        notes="Net-touchdown tiebreaker unavailable: final unresolved ties use a seeded draw.",
    )
