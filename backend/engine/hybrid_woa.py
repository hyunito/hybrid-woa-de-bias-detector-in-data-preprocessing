import math
import random
import numpy as np
from engine import fitness
from engine.hybrid_de import DEAuditor

class WOAAuditor:
    """
    Whale Optimization Algorithm (WOA) Auditor.
    Acts as the primary global exploration (scouting) stage of the hybrid metaheuristic.
    Navigates a 3D search space: [Script Index, Transformation Index, Demographic Group Index]
    to discover potential high-disparity bias hotspots across preprocessing pipelines.
    """
    DEFAULT_NUM_WHALES = 40
    DEFAULT_MAX_ITER = 20
    def __init__(self, metadata_logs = None, num_whales = DEFAULT_NUM_WHALES, max_iter = DEFAULT_MAX_ITER, de_params = None):
        """
        Initializes the WOA search swarm.

        :param metadata_logs: Optional list of provenance logs to initialize space from.
        :param num_whales: Number of search agents in the whale swarm.
        :param max_iter: Maximum exploration iterations.
        :param de_params: Optional dictionary of hyperparameters to configure the DE refinement stage.
        """
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
        self.all_biases = []

    def clip_position(self, pos):
        """
        Clips 3D continuous position coordinates to valid discrete boundaries of the search space.
        """
        if not self.scripts:
            return np.zeros(self.dim)
            
        s = int(round(np.clip(pos[0], 0, len(self.scripts) - 1)))
        script_name = self.scripts[s]
        
        trans_list = self.transformations.get(script_name, [])
        t_max = max(0, len(trans_list) - 1)
        t = int(round(np.clip(pos[1], 0, t_max)))
        trans_name = trans_list[t] if trans_list else "None"
        
        demo_list = self.demographics.get((script_name, trans_name), [])
        d_max = max(0, len(demo_list) - 1)
        d = int(round(np.clip(pos[2], 0, d_max)))
        
        return np.array([float(s), float(t), float(d)])

    def calculate_fitness(self, pos):
        """Evaluates 3D coordinate fitness using the pre-computed provenance cache."""
        score, _, _, _ = fitness.calculate_3d_fitness(pos[0], pos[1], pos[2])
        return score

    def run_woa(self, callback=None):
        """
        Executes the global WOA search across the 3D space, gathers whale population findings,
        and transitions the best-identified bias candidate as a seed to the DE refinement stage.

        :param callback: Optional streaming callback for real-time progress events.
        :return: Final audit results dictionary from hybrid DE refinement.
        """
        de_auditor = DEAuditor(metadata_logs=self.metadata_logs, **self.de_params)
            # Collect all valid (script_index, transformation_index) pairs
        all_trans = []
        for s_idx, s_name in enumerate(self.scripts):
            for t_idx in range(len(self.transformations.get(s_name, []))):
                all_trans.append((s_idx, t_idx))

        whales_per_trans = max(1, self.num_whales // len(all_trans))
        # Assign whales evenly across each transformation
        whales_pos = []
        for s_idx, t_idx in all_trans:
            s_name = self.scripts[s_idx]
            t_name = self.transformations[s_name][t_idx]
            demo_list = self.demographics.get((s_name, t_name), [])
            d_max = max(0, len(demo_list) - 1)
            for _ in range(whales_per_trans):
                d_val = random.randint(0, d_max)
                whales_pos.append([float(s_idx), float(t_idx), float(d_val)])


        whales_pos = np.array(whales_pos)
        self.best_fitness = float('-inf')
        self.best_position = whales_pos[0].copy()

        self.best_position = self.core_algo(whales_pos, callback=callback)

        dynamic_seeds = [entry["position"] for entry in self.transformation_bests.values()]
        # Transition to Phase 2: Differential Evolution (DE) local refinement seeded at WOA best
        result = de_auditor.run_de(
            seed_positions=dynamic_seeds,
            all_biases=self.all_biases,
            callback=callback
        )
        result["all_biases"] = self.all_biases
        return result

    def core_algo(self, whales_pos, callback=None):
        """
        Executes the iterative mathematical WOA hunting mechanism.
        Balances exploration and exploitation using coefficient vectors A and C,
        and switches between encircling prey, random search, and spiral bubble-net attack.
        """
        num_scripts = len(self.scripts)
        num_whales = len(whales_pos)
        whales_per_script = max(1, num_whales // num_scripts)

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

            a = 2 - (t * (2 / self.max_iter))

            for i in range(num_whales):
                s_idx = int(round(whales_pos[i][0]))
                t_idx = int(round(whales_pos[i][1]))
                lead_pos = self.transformation_bests[(s_idx, t_idx)]["position"]
                curr_pos = whales_pos[i]

                if random.random() < 0.5 and t < self.max_iter * 0.4:
                    s_name = self.scripts[s_idx]
                    t_name = self.transformations[s_name][t_idx]
                    d_list = self.demographics.get((s_name, t_name), [])
                    d_max = max(0, len(d_list) - 1)
                    whales_pos[i][2] = float(random.randint(0, d_max))
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
                        rand_idx = random.randint(0, num_whales - 1)
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
                new_pos[1] = float(t_idx)
                whales_pos[i] = self.clip_position(new_pos)

                dummy_fit, dummy_script, dummy_trans, dummy_demo = fitness.calculate_3d_fitness(
                    whales_pos[i][0], whales_pos[i][1], whales_pos[i][2]
                )
                self.all_biases.append({
                    "fitness_score": dummy_fit,
                    "script_name": dummy_script,
                    "transformation_name": dummy_trans,
                    "demographic_group": dummy_demo
                })

                if callback:
                    try:
                        callback({
                            "stage": "WOA",
                            "iteration": t + 1,
                            "step": len(self.all_biases),
                            "fitness_score": float(dummy_fit),
                            "best_fitness": float(self.best_fitness),
                            "script_name": dummy_script,
                            "transformation_name": dummy_trans,
                            "demographic_group": dummy_demo
                        })
                    except Exception:
                        pass
        
        return self.best_position


if __name__ == "__main__":
    auditor = WOAAuditor()
    results = auditor.run_woa()