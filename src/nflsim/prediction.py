"""Optional neural inference; missing weights use the generated EP policy."""

from .clock import period_seconds


class Predictor:
    def __init__(self, path):
        self.path = path
        self.model = None

    def __call__(self, state, rng):
        if not self.path.exists():
            return None
        import torch
        from .policy import StrategyAgent

        if self.model is None:
            self.model = StrategyAgent()
            self.model.load_state_dict(
                torch.load(self.path, map_location=self.model.device, weights_only=True)
            )
            self.model.net.eval()
        score_diff = (state.score1 - state.score2) * state.possession
        inputs = torch.tensor(
            [
                state.down,
                state.distance,
                state.loc,
                state.time if state.timing_mode == "plays" else state.time / 24,
                score_diff,
            ],
            dtype=torch.float32,
            device=self.model.device,
        )
        with torch.no_grad():
            probs = torch.softmax(self.model.net(inputs), dim=-1).cpu().tolist()
        late = (
            state.time <= 30
            if state.timing_mode == "plays"
            else state.period in (2, 4, 5) and period_seconds(state) <= 120
        )
        if (state.down != 4 and not late) or state.loc > 50:
            probs[2] = 0
        if state.down != 4 or state.loc <= 30:
            probs[3] = 0
        return rng.choices([1, 2, 3, 4], probs)[0]
