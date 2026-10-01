from .storage import DataUnavailable, require_team


def expected_points(repo, query):
    team = require_team(repo, query.year, query.team)
    records = repo.rows(
        "expected_points", year=query.year, team=team, is_defense=query.isDefense, down=query.down
    )
    # Use goal-to-go distance near the endzone rather than duplicate each yardline.
    distance = min(query.distance, 20)
    return sorted(
        [r for r in records if r["distance"] == min(distance, r["yardline"])],
        key=lambda r: r["yardline"],
    )


def decisions(repo, query):
    team = require_team(repo, query.year, query.team)
    distance = min(query.distance, 20)
    records = repo.rows(
        "coach_decision_probs",
        year=query.year,
        team=team,
        is_defense=query.isDefense,
        down=query.down,
    )
    eps = repo.rows(
        "expected_points", year=query.year, team=team, is_defense=query.isDefense, down=query.down
    )
    optimal = {(r["yardline"], r["distance"]): r for r in eps}
    result = []
    for row in records:
        if row["distance"] != min(distance, row["yardline"]):
            continue
        ep = optimal.get((row["yardline"], row["distance"]))
        result.append(
            {
                **row,
                "ep": ep["ep"] if ep else None,
                "opt_choice": ep["opt_choice"] + 1 if ep and ep["opt_choice"] is not None else None,
            }
        )
    return sorted(result, key=lambda r: r["yardline"])


def ranking_data(repo):
    output = {}
    for season in repo.seasons():
        rows = repo.rows("rankings", year=season["year"])
        if rows:
            output[str(season["year"])] = {
                r["team"]: {"offense": r["offense"], "defense": r["defense"]} for r in rows
            }
    return output


def exact_row(repo, table, **filters):
    rows = repo.rows(table, **filters)
    if not rows:
        raise DataUnavailable(
            f"Missing {table} data for {filters.get('team', 'special teams')} in {filters.get('year')}"
        )
    return rows[0]
