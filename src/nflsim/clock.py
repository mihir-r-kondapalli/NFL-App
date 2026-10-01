"""Approximate NFL clock administration; all play modes share these transitions.

Live-play times and runoff are explicit modeling assumptions, not measured tracking
data. Regular-season OT uses the 2025 both-possession rule and a ten-minute cap.
"""


def period_seconds(state):
    return state.time if state.period == 5 else max(0, state.time - (4 - state.period) * 900)


def display_clock(state):
    if state.timing_mode == "plays":
        return f"{state.time} plays remaining"
    seconds = period_seconds(state)
    return f"{'OT' if state.period == 5 else 'Q' + str(state.period)} {seconds // 60}:{seconds % 60:02d}"


def tick(state, seconds, warning=False):
    remaining = period_seconds(state)
    used = min(seconds, remaining)
    # A pre-snap runoff stops at the two-minute warning; a live play may cross it.
    if warning and state.period in (2, 4, 5) and remaining > 120 >= remaining - used:
        used = remaining - 120
        state.clock_running = False
    state.time -= used


def resolve_period(state, rng):
    if state.timing_mode != "clock" or state.pending_xp or state.finished:
        return
    if (
        state.period == 5
        and state.score1 != state.score2
        and (state.ot_completed == 3 or min(state.year1, state.year2) < (2010 if state.postseason else 2012))
    ):
        state.finished = True
    if period_seconds(state) > 0 and not state.finished:
        return
    state.clock_running = False
    if state.finished:
        state.time = 0
        return
    if state.period in (1, 3):
        state.period += 1
        state.message += f" End of quarter; Q{state.period} begins."
    elif state.period == 2:
        state.period = 3
        state.possession = -(state.opening_receiver or state.possession)
        state.timeouts1 = state.timeouts2 = 3
        state.drive = False
        state.safety_kick = False
        state.message += " Halftime. Second-half kickoff."
    elif state.period == 4 and state.score1 == state.score2:
        state.period = 5
        state.time = 600 if not state.postseason and min(state.year1, state.year2) >= 2017 else 900
        state.timeouts1 = state.timeouts2 = 3 if state.postseason else 2
        state.ot_completed = 0
        state.possession = rng.choice([-1, 1])
        state.drive = False
        state.safety_kick = False
        state.message += f" Overtime: {state.time // 60} minutes."
    elif state.period == 5 and state.postseason:
        state.ot_period += 1
        state.time = 900
        if state.ot_period % 2 == 1:
            state.timeouts1 = state.timeouts2 = 3
        state.message += f" Overtime period {state.ot_period} begins."
    else:
        state.finished = True
        state.time = 0


def presnap(state, rng):
    if not state.clock_running:
        return False
    remaining = period_seconds(state)
    diff = (state.score1 - state.score2) * state.possession
    late = state.period in (2, 4, 5) and remaining <= 120
    defense_timeout = "timeouts2" if state.possession == 1 else "timeouts1"
    offense_timeout = "timeouts1" if state.possession == 1 else "timeouts2"
    if late and diff > 0 and getattr(state, defense_timeout):
        setattr(state, defense_timeout, getattr(state, defense_timeout) - 1)
        state.clock_running = False
        state.message = "Defense calls timeout."
        return False
    if late and diff <= 0 and remaining <= 20 and getattr(state, offense_timeout):
        setattr(state, offense_timeout, getattr(state, offense_timeout) - 1)
        state.clock_running = False
        return False
    runoff = 40 if late and diff > 0 else rng.randint(8, 15) if late else rng.randint(25, 40)
    tick(state, runoff, warning=True)
    if period_seconds(state) == 0:
        state.message = "Clock expires before the next snap."
        resolve_period(state, rng)
        return True
    return False
