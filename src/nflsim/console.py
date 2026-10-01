"""Legacy text-player presentation over the shared game engine."""

import random
import re
from collections import Counter

from .models import GameState
from .clock import display_clock


def score(state):
    return f"({state.score1} - {state.score2})"


def names(state):
    if state.team1 == state.team2:
        return state.team1 + "1", state.team2 + "2"
    return state.team1, state.team2


def ball(state, cap=True):
    side = "own" if state.loc > 50 else "opp" if state.loc < 50 else "mid"
    return f"{'Ball' if cap else 'ball'} on {side} {min(state.loc, 100 - state.loc)}"


def status(state):
    markers = "".join(
        str(min(i // 10, 10 - i // 10)) if i % 10 == 0 and i not in (0, 100) else " "
        for i in range(101)
    )
    pos = 100 - state.loc if state.possession == 1 else state.loc
    target = 100 - state.target if state.possession == 1 else state.target
    field = "".join(
        "|"
        if i in (0, 100)
        else (">" if state.possession == 1 else "<")
        if i == pos
        else "x"
        if i == target
        else "-"
        for i in range(101)
    )
    down = ("1st", "2nd", "3rd", "4th")[state.down - 1]
    return f"\n{score(state)}|  Time: {display_clock(state)}\n\n{markers}\n{field}\n\n{ball(state)}, {down} & {state.distance}\n"


def human_choice(state, read, write):
    name = names(state)[0 if state.possession == 1 else 1]
    prompt = (
        f"{name}: 1 for xp try, 2 for 2pt try -> "
        if state.pending_xp
        else f"{name}: 1 to run, 2 to pass, 3 for fg, 4 to punt"
        + (", 5 for timeout, 6 to kneel" if state.timing_mode == "clock" else "")
        + " -> "
    )
    while True:
        value = read(prompt)
        if value == "0":
            return None
        if value in (
            ("1", "2")
            if state.pending_xp
            else ("1", "2", "3", "4", "5", "6")
            if state.timing_mode == "clock"
            else ("1", "2", "3", "4")
        ):
            choice = int(value)
            if not state.pending_xp and choice == 3 and state.loc > 50:
                write("Field Goals can only be attempted from the 50 yard line or closer.")
                continue
            if (
                choice == 5
                and not state.pending_xp
                and not (state.timeouts1 if state.possession == 1 else state.timeouts2)
            ):
                write("No timeouts remaining.")
                continue
            return (-2 if choice == 1 else -3) if state.pending_xp else choice
        write("Please enter a valid number.")


def result(message):
    replacements = {
        "XP made!": "---------XP IS MADE!---------",
        "XP missed!": "---------XP IS MISSED!---------",
        "2PT conversion made!": "---------2PT TRY IS GOOD!---------",
        "2PT conversion missed!": "---------2PT TRY IS FAILED!---------",
        "Field goal is GOOD!": "---------FG IS MADE!---------",
        "Field goal MISSED!": "---------FG IS MISSED!---------",
    }
    for old, new in replacements.items():
        message = message.replace(old, new)
    return (
        message.replace(" TOUCHDOWN!", "\n-------------TOUCHDOWN!-------------")
        .replace(" First down!", "\nFIRST DOWN!")
        .replace(" Turnover on downs.", "\n-------------TURNOVER ON DOWNS!-------------")
        .replace(" SAFETY!", "\n-------------SAFETY!-------------")
    )


def summary(state, stats, drives, plays, write):
    write(f"Final Score: {score(state)}\n")

    def pair(label, key, decimal=False, percent=False):
        values = [s[key] for s in stats]

        def fmt(v):
            return f"{v:.2f}{'%' if percent else ''}" if decimal else str(v)

        write(f"{label}: ({fmt(values[0])} - {fmt(values[1])})")

    for s in stats:
        s["yards"] = s["run_yds"] + s["pass_yds"]
        s["plays"] = s["runs"] + s["passes"]
        for key, numerator, denominator in (
            ("ypp", "yards", "plays"),
            ("run_avg", "run_yds", "runs"),
            ("pass_avg", "pass_yds", "passes"),
            ("pct", "comps", "passes"),
        ):
            s[key] = s[numerator] / s[denominator] if s[denominator] else 0
        s["pct"] *= 100
        s["incs"] = s["passes"] - s["comps"]
    for label, key, decimal in (
        ("Total Yards", "yards", False),
        ("Total Plays", "plays", False),
        ("Yards/Play", "ypp", True),
        ("Run Yards", "run_yds", False),
        ("Run Plays", "runs", False),
        ("Running Avg", "run_avg", True),
        ("Pass Yards", "pass_yds", False),
        ("Pass Plays", "passes", False),
        ("Passing Avg", "pass_avg", True),
        ("Fumbles", "fumbles", False),
        ("Ints Thrown", "ints", False),
        ("Total Punts", "punts", False),
        ("First Downs", "fds", False),
    ):
        pair(label, key, decimal, key == "pct")
    write(
        "Completions, incompletions, completion %, and sacks: unavailable in the shared play data"
    )
    write("\n\nDRIVE SUMMARY\n")
    clock_mode = state.timing_mode == "clock"
    if clock_mode:
        write("##| Play (drive plays) | -SCORE- | -----------------------------")
    else:
        write(f"##| {plays:3d} (--) | -SCORE- | -----------------------------")
    previous = 0 if clock_mode else plays
    for i, (time, a, b, name, text) in enumerate(drives, 1):
        duration = time - previous if clock_mode else previous - time
        write(f"{i:2d}| {time:3d} ({duration:2d}) | {a:2d} - {b:2d} | {name}: {text}")
        previous = time
    write(f"--| --- (--) | {state.score1:2d} - {state.score2:2d} | -----------------------------")


def play(engine, args, read=input, write=print):
    rng = random.Random(args.seed)
    mode = args.mode
    state = GameState(
        team1="NFL" if mode == 4 else args.team1,
        team2=args.team2,
        year1=args.season,
        year2=args.season,
        time=args.plays if args.timing_mode == "plays" else 3600,
        timing_mode=args.timing_mode,
        coach1="Human" if mode in (0, 1) else "AI" if mode == 4 else args.team1,
        coach2="Human" if mode == 0 else args.team2,
        possession=rng.choice([-1, 1]),
    )
    engine.validate_matchup(state)
    write(names(state)[0 if state.possession == 1 else 1] + " won the toss!\n")
    stats, drives = [Counter(), Counter()], []
    while engine.live(state):
        old = state
        index = 0 if state.possession == 1 else 1
        if not state.drive and not state.pending_xp:
            state, _ = engine.advance(state, -1, rng)
            write("\nRecieved " + ball(state, False) + "\n")
            if mode != 3 and read("Press enter to continue") == "0":
                break
            continue
        if state.drive:
            write(status(state))
            eps = []
            for team, year, name in zip(
                (state.team1, state.team2), (state.year1, state.year2), names(state)
            ):
                if team != "NFL":
                    eps.append(
                        f"{name} EP: {engine.ep(year, team, state.down, state.distance, state.loc)['ep']}"
                    )
            eps.append(
                f"NFL EP: {engine.ep(state.year1, 'NFL', state.down, state.distance, state.loc)['ep']}"
            )
            write(", ".join(eps))
        coach = state.coach1 if index == 0 else state.coach2
        if coach == "Human":
            choice = human_choice(state, read, write)
            if choice is None:
                break
        else:
            if mode != 3 and read("Press enter to continue") == "0":
                break
            choice = engine.conversion_choice(state) if state.pending_xp else engine.choose(state, rng)
        state, _ = engine.advance(state, choice, rng)
        write("\n" + result(state.message) + "\n")
        if (state.score1, state.score2) != (old.score1, old.score2) or old.pending_xp:
            write(score(state))
        s = stats[index]
        match = re.search(r"(Run|Pass|Kneel) for (-?\d+) yards", state.message)
        did_play = state.plays_elapsed > old.plays_elapsed
        if did_play and choice in (1, 2, 6):
            s["runs" if choice in (1, 6) else "passes"] += 1
            if match:
                gain = int(match[2])
                s["run_yds" if choice in (1, 6) else "pass_yds"] += min(gain, old.loc)
                if choice == 2 and gain != 0:
                    s["comps"] += 1
            s["fumbles"] += "Fumble" in state.message
            s["ints"] += "Interception" in state.message
            s["fds"] += "First down!" in state.message
        s["punts"] += did_play and choice == 4
        if not old.pending_xp and (
            state.pending_xp or not state.drive or state.possession != old.possession
        ):
            drives.append(
                (
                    state.plays_elapsed if state.timing_mode == "clock" else state.time,
                    state.score1,
                    state.score2,
                    names(old)[index],
                    state.message,
                )
            )
        elif old.pending_xp and drives:
            time, _, _, name, text = drives[-1]
            drives[-1] = (time, state.score1, state.score2, name, text)
    write("END OF GAME")
    summary(state, stats, drives, args.plays if args.timing_mode == "plays" else 3600, write)
    return state
