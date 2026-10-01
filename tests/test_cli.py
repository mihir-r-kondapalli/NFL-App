import pytest
from nflsim.cli import parser


def test_season_is_required_for_all_data_actions():
    for action in ("build", "rebuild", "import", "validate", "publish"):
        with pytest.raises(SystemExit) as exc:
            parser().parse_args(["data", action])
        assert exc.value.code == 2
    for command in ("simulate", "play", "train"):
        with pytest.raises(SystemExit):
            parser().parse_args([command])


def test_legacy_console_prompts_and_validation():
    from nflsim.console import human_choice, status
    from nflsim.models import GameState

    state = GameState(
        team1="PHI",
        team2="KC",
        year1=2030,
        year2=2030,
        drive=True,
        down=1,
        loc=75,
        target=65,
        distance=10,
    )
    answers = iter(["bad", "3", "2"])
    prompts, output = [], []

    def read(prompt):
        prompts.append(prompt)
        return next(answers)

    assert human_choice(state, read, output.append) == 2
    assert prompts[0] == "PHI: 1 to run, 2 to pass, 3 for fg, 4 to punt -> "
    assert output == [
        "Please enter a valid number.",
        "Field Goals can only be attempted from the 50 yard line or closer.",
    ]
    assert "Ball on own 25, 1st & 10" in status(state)
    state.drive = False
    state.pending_xp = True
    assert human_choice(state, lambda _: "2", output.append) == -3


def test_console_uses_shared_engine_and_prints_legacy_summary(repo):
    from nflsim.console import play
    from nflsim.engine import Engine

    args = parser().parse_args(
        ["play", "--season", "2030", "--plays", "4", "--mode", "3", "--timing-mode", "plays"]
    )
    output = []
    state = play(
        Engine(repo),
        args,
        read=lambda _: pytest.fail("unpaused mode prompted"),
        write=output.append,
    )
    text = "\n".join(output)
    assert state.time == 0
    assert "won the toss!" in text
    assert "NFL EP: 0.0" in text
    assert "Final Score:" in text
    assert "Total Plays: (4 - 0)" in text or "Total Plays: (0 - 4)" in text
    assert "DRIVE SUMMARY" in text


def test_console_quit_before_first_play_has_safe_summary(repo):
    from nflsim.console import play
    from nflsim.engine import Engine

    args = parser().parse_args(["play", "--season", "2030", "--timing-mode", "plays"])
    output = []
    state = play(Engine(repo), args, read=lambda _: "0", write=output.append)
    assert state.time == args.plays
    assert any("Final Score:" in line for line in output)


@pytest.mark.parametrize("export", [False, True])
def test_season_only_writes_with_explicit_output(tmp_path, monkeypatch, export):
    import sys
    from nflsim import cli
    from nflsim.config import Settings

    monkeypatch.setattr(cli.Settings, "from_env", lambda: Settings(tmp_path))
    monkeypatch.setattr(cli, "repository", lambda settings: object())
    monkeypatch.setattr(cli, "Engine", lambda repo: object())
    result = dict(games=[], standings=[])
    monkeypatch.setattr(cli, "simulate_season", lambda *a, **k: result)
    writes = []
    monkeypatch.setattr(cli, "write_results", lambda path, data: writes.append((path, data)))
    output = tmp_path / "requested.json"
    args = ["nflsim", "season", "simulate", "--season", "2030"]
    if export:
        args += ["--output", str(output)]
    monkeypatch.setattr(sys, "argv", args)
    cli.main()
    assert writes == ([(output, result)] if export else [])
    assert not (tmp_path / "results").exists()
