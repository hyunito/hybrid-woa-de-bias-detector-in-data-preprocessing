import random
import numpy as np
from numpy.random import rand, choice
import fitness


class DEAuditor:
    """
    Differential Evolution (DE) Auditor (Lightweight Benchmark Version).
    Acts as the secondary local exploitation / refinement stage of the hybrid metaheuristic.
    Optimized for minimal memory overhead and zero telemetry churn during benchmarks.
    """
    DEFAULT_POP_SIZE = 30
    DEFAULT_F = 0.5
    DEFAULT_CR = 0.9
    DEFAULT_MAX_STAGNATION = 25

    def __init__(self, metadata_logs=None, pop_size=DEFAULT_POP_SIZE, F=DEFAULT_F, CR=DEFAULT_CR, tolerance=1e-6, max_stagnation=DEFAULT_MAX_STAGNATION):
        self.pop_size = pop_size
        self.F = F
        self.CR = CR
        self.tolerance = tolerance
        self.max_stagnation = max_stagnation
        self.metadata_logs = metadata_logs

        self.scripts, self.transformations, self.demographics = fitness.get_space_dimensions(metadata_logs)
        if not self.scripts:
            print("Couldn't run the algorithm. No search log found.")
            return

        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

    def mutation(self, x):
        """Computes DE/rand/1 mutation vector: donor = a + F * (b - c)."""
        return x[0] + self.F * (x[1] - x[2])

    def crossover(self, mutated, target):
        """Applies binomial crossover between mutated donor vector and target individual."""
        p = rand(self.dim)
        jrand = random.randrange(self.dim)
        return [mutated[i] if p[i] < self.CR or i == jrand else target[i] for i in range(self.dim)]

    def clip_position(self, pos):
        """
        Clips a 3D position [s, t, d] to the valid uneven bounds of the search space.
        """
        
        if not self.scripts:
            return np.zeros(self.dim)
            
        s = int(round(np.clip(pos[0], 0, len(self.scripts) - 1)))
        script_name = self.scripts[s]
        
        t_max = len(self.transformations.get(script_name, [])) - 1
       
        t_max = max(0, t_max)
        t = int(round(np.clip(pos[1], 0, t_max)))
        
        trans_list = self.transformations.get(script_name, [])
        trans_name = trans_list[t] if trans_list else "None"
        
        d_max = len(self.demographics.get((script_name, trans_name), [])) - 1
        d_max = max(0, d_max)
        d = int(round(np.clip(pos[2], 0, d_max)))
        
        return np.array([float(s), float(t), float(d)])

    def calculate_fitness(self, pos):
        """Evaluates 3D coordinate fitness using the pre-computed provenance cache."""
        score, _, _, _ = fitness.calculate_3d_fitness(pos[0], pos[1], pos[2])
        return score

    def run_de(self, seed_positions=None, all_biases=None, callback=None):
        """
        Executes the main DE optimization loop over the 3D search space.
        Investigates the exact transformation spots discovered by WOA.
        """
        if seed_positions is None:
            raise ValueError("Hybrid DE requires seed positions from the WOA exploration stage.")

        if not isinstance(seed_positions, list) or (
            len(seed_positions) > 0 and not isinstance(seed_positions[0], (list, np.ndarray))
        ):
            seed_positions = [seed_positions]

        # 1. Start population directly with the EXACT spots from WOA (zero noise, zero jitter)
        pop = [self.clip_position(np.array(s, dtype=float)) for s in seed_positions]

        # 2. Fill the population to pop_size by cleanly replicating the exact seeds
        i = 0
        while len(pop) < self.pop_size:
            pop.append(pop[i % len(seed_positions)].copy())
            i += 1

        pop = np.array(pop)

        # 3. Run DE refinement on those exact spots
        self.best_position = self.core_algo(pop)

        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )

        return {
            "max_fitness_score": best_fitness,
            "script_name": best_script,
            "transformation_name": best_trans,
            "demographic_group": best_demo,
            "all_biases": all_biases if all_biases is not None else [],
        }

    def core_algo(self, pop):
        """
        Executes the Differential Evolution generation loop:
        Performs mutation, crossover, greedy selection, and early stopping based on stagnation.
        """
        fitness_vals = np.array([self.calculate_fitness(ind) for ind in pop])
        best_idx = int(np.argmax(fitness_vals))
        self.best_fitness = fitness_vals[best_idx]
        self.best_position = pop[best_idx].copy()
        stagnation_counter = 0
        previous_best = self.best_fitness

        while stagnation_counter < self.max_stagnation:
            for j in range(self.pop_size):
                # Select 3 distinct random candidates (a, b, c) excluding current target j
                candidates = [candidate for candidate in range(self.pop_size) if candidate != j]
                a, b, c = pop[choice(candidates, 3, replace=False)]

                mutated = self.clip_position(self.mutation([a, b, c]))
                trial = self.clip_position(np.array(self.crossover(mutated, pop[j])))

                # Greedy selection: replace target individual if trial produces strictly higher disparity
                obj_target = fitness_vals[j]
                obj_trial = self.calculate_fitness(trial)
                if obj_trial > obj_target:
                    pop[j] = trial
                    fitness_vals[j] = obj_trial
                    if obj_trial > self.best_fitness:
                        self.best_fitness = obj_trial
                        self.best_position = trial.copy()

            # Check for convergence: reset counter only if meaningful improvement exceeds tolerance
            if self.best_fitness - previous_best > self.tolerance:
                stagnation_counter = 0
                previous_best = self.best_fitness
            else:
                stagnation_counter += 1

        return self.best_position
