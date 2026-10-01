"""Combine offense and defense effects relative to their league distributions."""

import math


def matchup_pdf(offense, defense, off_league, def_league, shrink=0.15):
    """Regularized product of relative likelihoods, normalized to probability.

    A 15% league prior and bounded likelihood ratios prevent sparse/zero bins from
    overwhelming a matchup. These are uncalibrated defaults, not fitted ratings.
    """
    values = sorted(offense.keys() | defense.keys() | off_league.keys() | def_league.keys())

    def smooth(distribution):
        masses = {v: distribution.get(v, 0) + 0.0001 for v in values}
        total = sum(masses.values())
        return {v: p / total for v, p in masses.items()}

    ol, dl = smooth(off_league), smooth(def_league)
    off, deff = smooth(offense), smooth(defense)
    weights = {}
    for v in values:
        baseline = math.sqrt(ol[v] * dl[v])
        attack = (1 - shrink) * off[v] / ol[v] + shrink
        allowed = (1 - shrink) * deff[v] / dl[v] + shrink
        weights[v] = baseline * min(4, max(0.25, attack)) * min(4, max(0.25, allowed))
    total = sum(weights.values())
    return {v: p / total for v, p in weights.items()}
