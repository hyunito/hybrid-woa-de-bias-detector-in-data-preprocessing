import math
import random
import numpy as np
import fitness
from hybrid_de import DEAuditor


class WOAAuditor:
    """
    Whale Optimization Algorithm (WOA) Auditor.
    Acts as the primary global exploration (scouting) stage of the hybrid metaheuristic.
    Navigates a 3D search space: [Script Index, Transformation Index, Demographic Group Index]
    to discover potential high-disparity bias hotspots across preprocessing pipelines.
    """
    def __init__(self, metadata_logs=None, num_whales=30, max_iter=15):
        """
        Initializes the WOA search swarm.

        :param metadata_logs: Optional list of provenance logs to initialize space from.
        :param num_whales: Number of search agents in the whale swarm.
        :param max_iter: Maximum exploration iterations.
        """
        self.num_whales = num_whales
        self.max_iter = max_iter
        self.metadata_logs = metadata_logs
        
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
        de_auditor = DEAuditor(metadata_logs=self.metadata_logs)
        self.all_biases = []
        
        whales_pos = []
        for _ in range(self.num_whales):
            s_val = random.randint(0, len(self.scripts) - 1)
            script_name = self.scripts[s_val]
            
            trans_list = self.transformations.get(script_name, [])
            t_max = max(0, len(trans_list) - 1)
            t_val = random.randint(0, t_max)
            trans_name = trans_list[t_val] if trans_list else "None"
            
            demo_list = self.demographics.get((script_name, trans_name), [])
            d_max = max(0, len(demo_list) - 1)
            d_val = random.randint(0, d_max)
            
            whales_pos.append([float(s_val), float(t_val), float(d_val)])
            
        whales_pos = np.array(whales_pos)
        self.best_fitness = float('-inf')
        self.best_position = whales_pos[0].copy()
        
        self.best_position = self.core_algo(whales_pos, callback=callback)
                
        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )
      
        whales_info = []
        for i in range(self.num_whales):
            w_pos = whales_pos[i]
            w_fit, w_script, w_trans, w_demo = fitness.calculate_3d_fitness(w_pos[0], w_pos[1], w_pos[2])
            whales_info.append({
                "whale_id": i + 1,
                "position": w_pos.tolist(),
                "fitness_score": w_fit,
                "script_name": w_script,
                "transformation_name": w_trans,
                "demographic_group": w_demo
            })

        best_position_info = {
            "best_position": self.best_position.tolist(),
            "max_fitness_score": best_fitness,
            "script_name": best_script,
            "transformation_name": best_trans,
            "demographic_group": best_demo,
            "whales": whales_info,
        }

        # Transition to Phase 2: Differential Evolution (DE) local refinement seeded at WOA best
        result = de_auditor.run_de(
            seed_position=best_position_info["best_position"],
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

        :param whales_pos: Population coordinate array of shape (num_whales, 3).
        :param callback: Optional progress callback.
        :return: Global best position found by the whale swarm.
        """
        for t in range(self.max_iter):
            for i in range(self.num_whales):
                whales_pos[i] = self.clip_position(whales_pos[i])
                score = self.calculate_fitness(whales_pos[i])
                if score > self.best_fitness:
                    self.best_fitness = score
                    self.best_position = whales_pos[i].copy()

            # Linearly decrease parameter 'a' from 2 to 0 to transition from exploration to exploitation
            a = 2.0 - (t * (2.0 / self.max_iter)) 
            
            for i in range(self.num_whales):
                r1 = random.random()
                r2 = random.random()
                
                A = 2 * a * r1 - a
                C = 2 * r2
                
                l = random.uniform(-1, 1)
                p = random.random()
                
                if p < 0.5:
                    if abs(A) < 1:
                        # Exploitation: Encircling current best candidate position
                        D = abs(C * self.best_position - whales_pos[i])
                        new_pos = self.best_position - A * D
                    else:
                        # Exploration: Searching for new prey using a randomly selected agent
                        random_whale_idx = random.randint(0, self.num_whales - 1)
                        random_whale = whales_pos[random_whale_idx]
                        D = abs(C * random_whale - whales_pos[i])
                        new_pos = random_whale - A * D
                else:
                    # Exploitation: Spiral bubble-net attack modeling logarithmic path
                    D_prime = abs(self.best_position - whales_pos[i])
                    b = 1.0
                    new_pos = D_prime * math.exp(b * l) * math.cos(2 * math.pi * l) + self.best_position

                whales_pos[i] = self.clip_position(new_pos)

                dummy_fit, dummy_script, dummy_trans, dummy_demo = fitness.calculate_3d_fitness(
                    whales_pos[i][0], whales_pos[i][1], whales_pos[i][2]
                )
                self.all_biases.append({
                    "fitness_score": dummy_fit,
                    "script_name": dummy_script,
                    "transformation_name": dummy_trans,
                    "demographic_group": dummy_demo,
                    "source": "WOA"
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
