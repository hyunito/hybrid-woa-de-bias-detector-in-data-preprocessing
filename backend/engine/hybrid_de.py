import random
import numpy as np
from numpy.random import rand, choice
import fitness


class DEAuditor:
    """
    Differential Evolution (DE) Auditor.
    Acts as the secondary local exploitation / refinement stage of the hybrid metaheuristic.
    Seeded around the best position found by WOA, it uses mutation and crossover to fine-tune
    coordinates and confirm the maximum-disparity bias hotspot.
    """
    def __init__(self, metadata_logs=None, pop_size=30, F=0.5, CR=0.7, tolerance=1e-6, max_stagnation=25):
        """
        Initializes the DE Auditor with a 3D search space.

        :param metadata_logs: Optional provenance logs to initialize space from.
        :param pop_size: Population size of individuals in the DE population.
        :param F: Differential mutation scaling factor.
        :param CR: Crossover probability.
        :param tolerance: Minimum fitness improvement to reset stagnation counter.
        :param max_stagnation: Maximum generations without improvement before early stopping.
        """
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
        """
        Computes DE/rand/1 mutation vector: donor = a + F * (b - c).
        Scales the difference between two individuals to guide search direction and step size.
        """
        return x[0] + self.F * (x[1] - x[2])

    def crossover(self, mutated, target):
        """
        Applies binomial crossover between mutated donor vector and target individual.
        Guarantees at least one coordinate from the mutant via random index jrand.
        """
        p = rand(self.dim)
        jrand = random.randrange(self.dim)
        return [mutated[i] if p[i] < self.CR or i == jrand else target[i] for i in range(self.dim)]

    def clip_position(self, pos):
        """Clips 3D continuous position coordinates to valid discrete boundaries of the search space."""
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

    def run_de(self, seed_position=None, seed_jitter=6.0, all_biases=None, callback=None):
        """
        Executes the main DE optimization loop over the 3D search space.
        When seed_position is provided from WOA, initializes population in a bounded
        neighborhood around that point to perform focused local refinement.

        :param seed_position: Starting best position identified by the global WOA stage.
        :param seed_jitter: Perturbation radius for seeding initial DE individuals.
        :param all_biases: Shared list collecting all bias records across stages.
        :param callback: Optional progress callback.
        :return: Final audit report dictionary with ranked findings and individual points.
        """
        if all_biases is None:
            all_biases = []
        pop = []

        if seed_position is not None:
            seed_position = np.array(seed_position, dtype=float)
            for _ in range(self.pop_size):
                jitter = np.random.uniform(-seed_jitter, seed_jitter, size=self.dim)
                individual = self.clip_position(seed_position + jitter)
                pop.append(individual.tolist())
        else:
            for _ in range(self.pop_size):
                s_val = random.randint(0, len(self.scripts) - 1)
                script_name = self.scripts[s_val]

                trans_list = self.transformations.get(script_name, [])
                t_max = max(0, len(trans_list) - 1)
                t_val = random.randint(0, t_max)
                trans_name = trans_list[t_val] if trans_list else "None"

                demo_list = self.demographics.get((script_name, trans_name), [])
                d_max = max(0, len(demo_list) - 1)
                d_val = random.randint(0, d_max)

                pop.append([float(s_val), float(t_val), float(d_val)])

        pop = np.array(pop)

        self.best_position = self.core_algo(pop, all_biases=all_biases, callback=callback)

        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )

        pop_info = []
        for i in range(self.pop_size):
            ind_pos = pop[i]
            ind_fit, ind_script, ind_trans, ind_demo = fitness.calculate_3d_fitness(ind_pos[0], ind_pos[1], ind_pos[2])
            pop_info.append({
                "pop_id": i + 1,
                "position": ind_pos.tolist(),
                "fitness_score": ind_fit,
                "script_name": ind_script,
                "transformation_name": ind_trans,
                "demographic_group": ind_demo
            })

        return {
            "max_fitness_score": best_fitness,
            "script_name": best_script,
            "transformation_name": best_trans,
            "demographic_group": best_demo,
            "individuals": pop_info,
            "all_biases": all_biases,
        }

    def core_algo(self, pop, all_biases=None, callback=None):
        """
        Executes the Differential Evolution generation loop:
        Performs mutation, crossover, greedy selection, and early stopping based on stagnation.

        :param pop: Array of initial population coordinates.
        :param all_biases: Telemetry list accumulating evaluated candidates.
        :param callback: Optional progress callback.
        :return: Best position found by DE.
        """
        if all_biases is None:
            all_biases = []

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
                trial = self.clip_position(self.crossover(mutated, pop[j]))

                dummy_fit, dummy_script, dummy_trans, dummy_demo = fitness.calculate_3d_fitness(
                    trial[0], trial[1], trial[2]
                )
                all_biases.append({
                    "fitness_score": dummy_fit,
                    "script_name": dummy_script,
                    "transformation_name": dummy_trans,
                    "demographic_group": dummy_demo,
                    "source": "DE"
                })

                if callback:
                    try:
                        callback({
                            "stage": "DE",
                            "step": len(all_biases),
                            "fitness_score": float(dummy_fit),
                            "best_fitness": float(self.best_fitness),
                            "script_name": dummy_script,
                            "transformation_name": dummy_trans,
                            "demographic_group": dummy_demo
                        })
                    except Exception:
                        pass

                # Greedy selection: replace target individual if trial produces strictly higher disparity
                obj_target = fitness_vals[j]
                obj_trial = self.calculate_fitness(trial)
                if obj_trial > obj_target:
                    pop[j] = trial
                    fitness_vals[j] = obj_trial
                    if obj_trial > self.best_fitness:
                        self.best_fitness = obj_trial
                        self.best_position = np.array(trial)

            # Check for convergence: reset counter only if meaningful improvement exceeds tolerance
            if self.best_fitness - previous_best > self.tolerance:
                stagnation_counter = 0
                previous_best = self.best_fitness
            else:
                stagnation_counter += 1

        return self.best_position


if __name__ == "__main__":
    auditor = DEAuditor()
    result = auditor.run_de()
