"""Policy-gradient training against generated coach data using the shared engine."""

import csv
import random

from .clock import period_seconds
from .engine import Engine
from .models import GameState
from .storage import repository


def train(settings, args):
    import torch
    from .policy import StrategyAgent

    if args.plays < 1 or args.plays > 500:
        raise ValueError("Plays must be 1-500")
    if args.episodes < 1:
        raise ValueError("Episodes must be positive")
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    rng = random.Random(args.seed)
    agent = StrategyAgent(lr=0.0001)
    if settings.model_path.exists():
        agent.load_state_dict(
            torch.load(settings.model_path, weights_only=True, map_location=agent.device)
        )
    engine = Engine(repository(settings))
    settings.model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics = settings.model_path.with_suffix(".csv")
    with metrics.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["episode", "score1", "score2", "loss"])
        for episode in range(args.episodes):
            state = GameState(
                team1=args.team1,
                team2=args.team2,
                year1=args.season,
                year2=args.season,
                coach1="AI",
                coach2=args.team2,
                time=args.plays if args.timing_mode == "plays" else 3600,
                timing_mode=args.timing_mode,
                possession=rng.choice([-1, 1]),
            )
            last_diff = 0
            while engine.live(state):
                if state.pending_xp:
                    state, _ = engine.advance(state, engine.conversion_choice(state), rng)
                elif not state.drive or state.possession == -1:
                    state, _ = engine.advance(state, -1, rng)
                else:
                    inputs = torch.tensor(
                        [
                            state.down,
                            state.distance,
                            state.loc,
                            state.time if state.timing_mode == "plays" else state.time / 24,
                            state.score1 - state.score2,
                        ],
                        dtype=torch.float32,
                        device=agent.device,
                    )
                    logits = agent.net(inputs)
                    late = (
                        state.time <= 30
                        if state.timing_mode == "plays"
                        else state.period in (2, 4, 5) and period_seconds(state) <= 120
                    )
                    mask = torch.tensor(
                        [
                            True,
                            True,
                            (state.down == 4 or late) and state.loc <= 50,
                            state.down == 4 and state.loc > 30,
                        ],
                        device=agent.device,
                    )
                    distribution = torch.distributions.Categorical(
                        logits=logits.masked_fill(~mask, float("-inf"))
                    )
                    action = distribution.sample()
                    before_plays = state.plays_elapsed
                    state, _ = engine.advance(state, int(action.item()) + 1, rng)
                    if state.plays_elapsed > before_plays:
                        agent.record(
                            distribution.log_prob(action),
                            0.0,
                            distribution.entropy(),
                        )
                diff = state.score1 - state.score2
                if agent.trajectory:
                    lp, reward, entropy = agent.trajectory[-1]
                    agent.trajectory[-1] = (lp, reward + float(diff - last_diff), entropy)
                last_diff = diff
            # Include rewards from the opponent's response in the final return.
            if agent.trajectory:
                lp, reward, entropy = agent.trajectory[-1]
                agent.trajectory[-1] = (
                    lp,
                    reward + float(state.score1 - state.score2) / 10,
                    entropy,
                )
                loss = agent.optimize_episode()
            else:
                loss = 0
            writer.writerow([episode + 1, state.score1, state.score2, loss])
            handle.flush()
            print(f"Episode {episode + 1}/{args.episodes}: {state.score1}-{state.score2}")
            if (episode + 1) % 100 == 0 or episode + 1 == args.episodes:
                temporary = settings.model_path.with_suffix(".tmp")
                torch.save(agent.state_dict(), temporary)
                temporary.replace(settings.model_path)
