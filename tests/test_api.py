from fastapi.testclient import TestClient
from nflsim.api import create_app
from nflsim.models import GameState


def test_no_data_startup_and_validation(tmp_path):
    from nflsim.config import Settings

    client = TestClient(create_app(Settings(tmp_path)))
    assert client.get("/health").json()["seasons"] == []
    assert client.get("/metadata").json() == {"seasons": [], "rankings": {}}
    assert (
        client.post("/expected-points", json={"team": "PHI", "down": 1, "distance": 10}).status_code
        == 422
    )
    assert (
        client.post(
            "/expected-points", json={"team": "PHI", "year": 2030, "down": 1, "distance": 10}
        ).status_code
        == 404
    )


def test_data_routes_and_zero_optimal_choice(local_repo):
    settings, repo = local_repo
    client = TestClient(create_app(settings, repo))
    query = dict(team="PHI", year=2030, isDefense=False, down=1, distance=10)
    points = client.post("/expected-points", json=query).json()["data"]
    assert len(points) == 99
    assert points[0]["distance"] == 1 and points[0]["ep"] == 0
    choices = client.post("/decisions", json=query).json()["data"]
    assert all(r["opt_choice"] == 1 and r["ep"] == 0 for r in choices)
    assert client.get("/metadata").json()["rankings"]["2030"]["PHI"]["offense"] == 1.0


def test_advance_contract_and_invalid_requests(local_repo):
    settings, repo = local_repo
    client = TestClient(create_app(settings, repo))
    state = GameState(team1="PHI", team2="KC", year1=2030, year2=2030)
    response = client.post("/advance", json={"state": state.model_dump(), "choice": -1})
    assert response.status_code == 200
    new_state, status = response.json()
    assert status == 1 and new_state["drive"] and "pending_xp" in new_state
    bad = {**new_state, "distance": 100}
    assert client.post("/advance", json={"state": bad, "choice": 1}).status_code == 422
    assert (
        client.post(
            "/simulate",
            json={"team1": "PHI", "team2": "KC", "year1": 2030, "year2": 2030, "num_games": 0},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/predict", json={"down": 1, "distance": 10, "loc": 50, "time": 10, "score_diff": 0}
        ).status_code
        == 422
    )


def test_bot_touchdown_completes_conversion_in_same_request(local_repo):
    settings, repo = local_repo
    client = TestClient(create_app(settings, repo))
    state = GameState(team1='PHI', team2='KC', year1=2030, year2=2030,
                      coach1='PHI', coach2='Human', loc=3, target=0,
                      down=1, distance=3, drive=True, time=1)
    response = client.post('/advance', json={'state': state.model_dump(), 'choice': 1, 'seed': 1})
    assert response.status_code == 200
    updated, status = response.json()
    assert not updated['pending_xp'] and status == 0
    assert updated['score1'] == 7
    assert 'Run for 3 yards.' in updated['message'] and 'XP made!' in updated['message']
