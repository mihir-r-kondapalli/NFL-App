import json
import numpy as np
import os
import random
from collections import defaultdict

class Play_Data:
    def __init__(self, directory_or_pair, punt_file):
        self.data = {"rush": defaultdict(dict), "pass": defaultdict(dict)}
        self.play_types = ["rush", "pass"]
        self.yardline_bins = {
            **{i: i for i in range(1, 21)},
            **{i: (21, 23) for i in range(21, 24)},
            **{i: (24, 27) for i in range(24, 28)},
            **{i: (28, 32) for i in range(28, 33)},
            **{i: (33, 38) for i in range(33, 39)},
            **{i: (39, 44) for i in range(39, 45)},
            **{i: (45, 50) for i in range(45, 51)},
            **{i: (51, 70) for i in range(51, 71)},
            **{i: (71, 85) for i in range(71, 86)},
            **{i: (86, 99) for i in range(86, 100)}
        }

        self.fg_prob = [
            1.0, 0.9875, 1.0, 0.9919, 0.9937, 0.9929, 0.9797, 0.9818, 0.9693, 0.977,
            0.9479, 0.983, 0.9777, 0.9459, 0.9659, 0.899, 0.92, 0.9167, 0.9347, 0.893,
            0.9053, 0.8603, 0.7956, 0.822, 0.7885, 0.8, 0.7405, 0.7267, 0.7231, 0.6986,
            0.7394, 0.7416, 0.7216, 0.6911, 0.6994, 0.7059, 0.6129, 0.5595, 0.6271, 0.5297,
            0.4935, 0.4548, 0.4136, 0.3697, 0.3230, 0.2735, 0.2211, 0.1655, 0.1069, 0.0450
        ]

        self.punt_data = self.load_punt_data(punt_file)

        if isinstance(directory_or_pair, tuple):
            self.load_and_blend_files(directory_or_pair[0], directory_or_pair[1])
        else:
            self.load_files(directory_or_pair)

    def load_punt_data(self, punt_file):
        try:
            with open(punt_file, "r") as file:
                return json.load(file)
        except Exception as e:
            print(f"Error loading punt data: {e}")
            return {}

    def load_files(self, directory):
        for play_type in self.play_types:
            for bin_range in set(self.yardline_bins.values()):
                yl_str = f"{bin_range}" if isinstance(bin_range, int) else f"{bin_range[0]}-{bin_range[1]}"
                file_path = os.path.join(directory, f"{play_type}_cdf_yl{yl_str}.json")
                if os.path.exists(file_path):
                    with open(file_path, "r") as file:
                        data = json.load(file)
                        for key, value in data.items():
                            down, dist = map(int, key.split("-"))
                            self.data[play_type][(down, dist, bin_range)] = value

    def load_and_blend_files(self, off_dir, def_dir):
        for play_type in self.play_types:
            for bin_range in set(self.yardline_bins.values()):
                yl_str = f"{bin_range}" if isinstance(bin_range, int) else f"{bin_range[0]}-{bin_range[1]}"
                off_file = os.path.join(off_dir, f"{play_type}_cdf_yl{yl_str}.json")
                def_file = os.path.join(def_dir, f"{play_type}_cdf_yl{yl_str}.json")
                if not os.path.exists(off_file) or not os.path.exists(def_file):
                    continue
                with open(off_file, "r") as f1, open(def_file, "r") as f2:
                    off_data = json.load(f1)
                    def_data = json.load(f2)
                for key in off_data:
                    down, dist = map(int, key.split("-"))
                    off_entry = off_data[key]
                    def_entry = def_data.get(key, {"values": [0], "cdf": [1]})
                    blended = self.blend_entries(off_entry, def_entry)
                    self.data[play_type][(down, dist, bin_range)] = blended

    def blend_entries(self, off_entry, def_entry):
        ovals = off_entry.get("values", [0])
        ocd = off_entry.get("cdf", [1])
        dvals = def_entry.get("values", [0])
        dcd = def_entry.get("cdf", [1])
        if not isinstance(ovals, list): ovals = [ovals]
        if not isinstance(ocd, list): ocd = [ocd]
        if not isinstance(dvals, list): dvals = [dvals]
        if not isinstance(dcd, list): dcd = [dcd]

        def cdf_to_pdf(vals, cdf):
            return dict(zip(vals, np.diff([0] + list(cdf))))

        def weighted_blend(opdf, dpdf):
            off_weight_scale = 1.0
            def_weight_scale = 0.5
            all_vals = sorted(set(opdf) | set(dpdf))
            probs = []
            for v in all_vals:
                po = opdf.get(v, 0.0)
                pd = dpdf.get(v, 0.0)
                if v <= -2100: w = (0.2, 0.8)
                elif v <= -1100: w = (0.3, 0.7)
                elif v >= 11 and (v - 10) <= 99: w = (0.85, 0.15)
                elif v < 0: w = (0.4, 0.6)
                elif v <= 3: w = (0.5, 0.5)
                elif v <= 15: w = (0.6, 0.4)
                else: w = (0.6, 0.4)
                w_off = w[0] * off_weight_scale
                w_def = w[1] * def_weight_scale
                total = w_off + w_def
                w_off /= total
                w_def /= total
                probs.append(w_off * po + w_def * pd)
            probs = np.array(probs)
            probs /= probs.sum() if probs.sum() > 0 else 1
            return all_vals, np.cumsum(probs).round(6).tolist()

        opdf = cdf_to_pdf(ovals, ocd)
        dpdf = cdf_to_pdf(dvals, dcd)
        vals, cdf = weighted_blend(opdf, dpdf)
        return {"values": vals, "cdf": cdf}

    def sample_from_cdf(self, entry):
        values = entry.get("values", [0])
        cdf = entry.get("cdf", [1])
        if not isinstance(values, list): values = [values]
        if not isinstance(cdf, list): cdf = [cdf]
        if len(values) != len(cdf): return 0
        rnd = random.random()
        for i, threshold in enumerate(cdf):
            if rnd <= threshold:
                return values[i]
        return values[-1]

    def get_val(self, down, distance, play_type, yardline):
        yardline_bin = self.yardline_bins.get(yardline, (1, 10))
        key = (down, distance, yardline_bin)
        if key in self.data[play_type] and self.data[play_type][key]:
            return self.sample_from_cdf(self.data[play_type][key])
        if down > 1:
            return self.get_val(down - 1, distance, play_type, yardline)
        if distance > 1:
            return self.get_val(1, distance - 1, play_type, yardline)
        return 0

    def get_run_val(self, down, distance, yardline):
        return self.get_val(down, distance, "rush", yardline)

    def get_pass_val(self, down, distance, yardline):
        return self.get_val(down, distance, "pass", yardline)

    def get_kick_val(self, yardline):
        if yardline < 1 or yardline >= 51:
            return 0
        kick_prob = self.fg_prob[yardline - 1]
        return 1 if np.random.uniform(0, 1) < kick_prob else 0

    def get_punt_val(self, yardline):
        if str(yardline) in self.punt_data:
            return random.choice(self.punt_data[str(yardline)])
        if yardline >= 100:
            return 0
        return self.get_punt_val(yardline + 1)