"""Validate portable special-teams profiles before either adapter imports them."""

import math


def validate_profile(profile):
    def probability(value):
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("Invalid profile probability")

    for key in ("xp_prob", "out_of_bounds_prob", "zero_pass_incomplete_prob"):
        probability(profile[key])
    if len(profile["fg_probs"]) != 99:
        raise ValueError("Profile requires 99 field goal probabilities")
    for value in profile["fg_probs"]:
        probability(value)
    outcomes = profile["kickoffs"]
    if not outcomes:
        raise ValueError("Profile requires kickoff outcomes")
    for outcome in outcomes:
        if not isinstance(outcome["loc"], int) or not 0 <= outcome["loc"] <= 99:
            raise ValueError("Invalid kickoff field position")
        if outcome.get("td", False) != (outcome["loc"] == 0):
            raise ValueError("Kickoff touchdown must end at the endzone")
        probability(outcome["weight"])
    if abs(sum(r["weight"] for r in outcomes) - 1) > 0.001:
        raise ValueError("Kickoff weights must sum to one")
    if set(profile["punts"]) != {str(v) for v in range(1, 100)}:
        raise ValueError("Profile requires all punt yardlines")
    for punt in profile["punts"].values():
        if not punt["values"] or len(punt["values"]) != len(punt["weights"]):
            raise ValueError("Malformed punt profile")
        if any(not isinstance(v, int) for v in punt["values"]):
            raise ValueError("Punt outcomes must be integer encodings")
        for weight in punt["weights"]:
            probability(weight)
        if abs(sum(punt["weights"]) - 1) > 0.001:
            raise ValueError("Punt weights must sum to one")
