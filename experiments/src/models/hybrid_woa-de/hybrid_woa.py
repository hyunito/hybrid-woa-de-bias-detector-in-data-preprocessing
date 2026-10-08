import math
import random
import numpy as np
import fitness
from hybrid_de import DEAuditor


class WOAAuditor:
    """
    Whale Optimization Algorithm (WOA) Auditor (Lightweight Benchmark Version).
    Acts as the primary global exploration (scouting) stage of the hybrid metaheuristic.
    Navigates a 3D search space: [Script Index, Transformation Index, Demographic Group Index]
    to discover potential high-disparity bias hotspots across preprocessing pipelines.
    Optimized for minimal memory overhead and zero telemetry churn during benchmarks.
    """
    DEFAULT_NUM_WHALES = 30
    DEFAULT_MAX_ITER = 30

    def __init__(self, metadata_logs=None, num_whales=DEFAULT_NUM_WHALES, max_iter=DEFAULT_MAX_ITER, de_params=None):
        self.num_whales = num_whales
        self.max_iter = max_iter
        self.metadata_logs = metadata_logs
        self.de_params = de_params or {}

        self.scripts, self.transformations, self.demographics = fitness.get_space_dimensions(metadata_logs)
        if not self.scripts:
            print("Couldn't run the algorithm. No search log found.")
            return

        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

    def clip_position(self, pos):
        """Clips 3D continuous position coordinates in-place to avoid heap allocations."""
        if not self.scripts:
            return pos

        s = int(round(np.clip(pos[0], 0, len(self.scripts) - 1)))
        script_name = self.scripts[s]

        trans_list = self.transformations.get(script_name, [])
        t_max = max(0, len(trans_list) - 1)
        t = int(round(np.clip(pos[1], 0, t_max)))
        trans_name = trans_list[t] if trans_list else "None"

        demo_list = self.demographics.get((script_name, trans_name), [])
        d_max = max(0, len(demo_list) - 1)
        d = int(round(np.clip(pos[2], 0, d_max)))

        pos[0], pos[1], pos[2] = float(s), float(t), float(d)
        return pos

    def calculate_fitness(self, pos):
        """Evaluates 3D coordinate fitness using the pre-computed provenance cache."""
        score, _, _, _ = fitness.calculate_3d_fitness(pos[0], pos[1], pos[2])
        return score

    def run_woa(self):
        """
        Executes the global WOA search across the 3D space, gathers whale population findings,
        and transitions the best-identified bias candidate as a seed to the DE refinement stage.
        :return: Final audit results dictionary from hybrid DE refinement.
        """
        de_auditor = DEAuditor(metadata_logs=self.metadata_logs, **self.de_params)
        num_scripts = len(self.scripts)
        whales_per_script = max(1, self.num_whales // num_scripts)

        whales_pos = []
        for s in range(num_scripts):
            script_name = self.scripts[s]
            trans_list = self.transformations.get(script_name, [])
            t_max = max(0, len(trans_list) - 1)
            for _ in range(whales_per_script):
                t_val = random.randint(0, t_max)
                trans_name = trans_list[t_val] if trans_list else "None"
                demo_list = self.demographics.get((script_name, trans_name), [])
                d_max = max(0, len(demo_list) - 1)
                d_val = random.randint(0, d_max)
                whales_pos.append([float(s), float(t_val), float(d_val)])

        whales_pos = np.array(whales_pos)
        self.best_fitness = float('-inf')
        self.best_position = whales_pos[0].copy()

        self.best_position = self.core_algo(whales_pos)

        dynamic_seeds = [entry["position"] for entry in self.transformation_bests.values()]
        # Transition to Phase 2: Differential Evolution (DE) local refinement seeded at WOA best
        result = de_auditor.run_de(seed_positions=dynamic_seeds)
        return result

    def core_algo(self, whales_pos):
        """
        Executes the iterative mathematical WOA hunting mechanism.
        Balances exploration and exploitation using coefficient vectors A and C,
        and switches between encircling prey, random search, and spiral bubble-net attack.
        """
        num_scripts = len(self.scripts)
        num_whales = len(whales_pos)
        whales_per_script = max(1, num_whales // num_scripts)

        # 1. Initialize BOTH script-level and transformation-level tracking
        self.script_bests = {}
        self.transformation_bests = {}
        for s_idx, s_name in enumerate(self.scripts):
            t_list = self.transformations.get(s_name, [])
            for t_idx, t_name in enumerate(t_list):
                init_p = self.clip_position(np.array([float(s_idx), float(t_idx), 0.0]))
                init_f = self.calculate_fitness(init_p)
                self.transformation_bests[(s_idx, t_idx)] = {"fitness": init_f, "position": init_p.copy()}
                if s_idx not in self.script_bests or init_f > self.script_bests[s_idx]["fitness"]:
                    self.script_bests[s_idx] = {"fitness": init_f, "position": init_p.copy()}

        for t in range(self.max_iter):
            # Evaluate all whales
            for i in range(num_whales):
                self.clip_position(whales_pos[i])
                score = self.calculate_fitness(whales_pos[i])
                s_idx = int(round(whales_pos[i][0]))
                t_idx = int(round(whales_pos[i][1]))

                # Update transformation-level best
                if (s_idx, t_idx) in self.transformation_bests:
                    if score > self.transformation_bests[(s_idx, t_idx)]["fitness"]:
                        self.transformation_bests[(s_idx, t_idx)] = {
                            "fitness": score,
                            "position": whales_pos[i].copy()
                        }

                # Update script-level sub-swarm leader
                if s_idx in self.script_bests:
                    if score > self.script_bests[s_idx]["fitness"]:
                        self.script_bests[s_idx] = {
                            "fitness": score,
                            "position": whales_pos[i].copy()
                        }

                if score > self.best_fitness:
                    self.best_fitness = score
                    self.best_position = whales_pos[i].copy()

            # Linearly decrease parameter 'a' from 2 to 0
            a = 2.0 - (t * (2.0 / self.max_iter))

            # Script-Preserving Multi-Swarm Movement
            for i in range(num_whales):
                s_idx = i // whales_per_script
                lead_pos = self.script_bests[s_idx]["position"]
                curr_pos = whales_pos[i]

                # Long-range demographic jump with 15% probability in early iterations
                if random.random() < 0.15 and t < self.max_iter * 0.7:
                    s_name = self.scripts[s_idx]
                    t_list = self.transformations.get(s_name, [])
                    t_rand = random.randint(0, max(0, len(t_list) - 1))
                    t_name = t_list[t_rand] if t_list else "None"
                    d_list = self.demographics.get((s_name, t_name), [])
                    d_rand = random.randint(0, max(0, len(d_list) - 1))
                    whales_pos[i] = np.array([float(s_idx), float(t_rand), float(d_rand)])
                    continue

                r1 = random.random()
                r2 = random.random()
                A = 2 * a * r1 - a
                C = 2 * r2
                l = random.uniform(-1, 1)
                p = random.random()

                if p < 0.5:
                    if abs(A) < 1:
                        # Encircling script leader
                        D = abs(C * lead_pos - curr_pos)
                        new_pos = lead_pos - A * D
                    else:
                        # Random search within the same script sub-swarm
                        rand_idx = s_idx * whales_per_script + random.randint(0, whales_per_script - 1)
                        rand_whale = whales_pos[rand_idx]
                        D = abs(C * rand_whale - curr_pos)
                        new_pos = rand_whale - A * D
                else:
                    # Spiral bubble-net attack around script leader
                    D_prime = abs(lead_pos - curr_pos)
                    b = 1.0
                    new_pos = D_prime * math.exp(b * l) * math.cos(2 * math.pi * l) + lead_pos

                # Anchor whale permanently inside its assigned script
                new_pos[0] = float(s_idx)
                whales_pos[i] = self.clip_position(new_pos)

        return self.best_position


if __name__ == "__main__":
    auditor = WOAAuditor()
    results = auditor.run_woa()
    print("Optimization finished:", results)
