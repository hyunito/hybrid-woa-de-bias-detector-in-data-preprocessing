import numpy as np
from numpy.random import rand
from numpy.random import choice
import random
import fitness

class DEAuditor:

    def __init__(self, metadata_logs=None, pop_size=30, F=0.5, CR=0.7, tolerance=1e-6, max_stagnation=25):
        """
        Initializes the DE Auditor with a 3D search space.
        :param metadata_logs: Optional list of dictionaries representing the JSONB logs.
                            If None, will fetch from PostgreSQL database.
        :param pop_size: Population size of individuals in the DE population.
        """
        self.pop_size = pop_size
        self.F = F
        self.CR = CR
        self.tolerance = tolerance
        self.max_stagnation = max_stagnation

        self.metadata_logs = metadata_logs
        if metadata_logs is not None:
            if fitness._logs_cache is None or not fitness._fitness_cache:
                fitness._logs_cache = None
                fitness._fitness_cache = {}
                fitness.load_provenance_data(metadata_logs)
            self.scripts = fitness._scripts
            self.transformations = fitness._transformations
            self.demographics = fitness._demographics
        else:

            self.scripts, self.transformations, self.demographics = fitness.get_space_dimensions()
            if not self.scripts:
                print("Couldn't run the algorithm. No search log found.")
                return

        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

    def mutation(self, x):
        return x[0] + self.F * (x[1] - x[2])

    def crossover(self, mutated, target):
        p = rand(self.dim)
        jrand = random.randrange(self.dim)
        trial = [mutated[i] if p[i] < self.CR or i == jrand else target[i] for i in range(self.dim)]
        return trial

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
        """
        Calls calculate_3d_fitness using s_idx, t_idx, d_idx coordinates.
        """
        score, _, _, _ = fitness.calculate_3d_fitness(pos[0], pos[1], pos[2])

        return score

    def run_de(self, seed_position=None, seed_jitter=6.0, all_biases=None, callback=None):
        """
        Executes the main DE optimization loop over the 3D search space.
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

                t_max = len(self.transformations.get(script_name, [])) - 1
                t_max = max(0, t_max)
                t_val = random.randint(0, t_max)
                trans_list = self.transformations.get(script_name, [])
                trans_name = trans_list[t_val] if trans_list else "None"

                d_max = len(self.demographics.get((script_name, trans_name), [])) - 1
                d_max = max(0, d_max)
                d_val = random.randint(0, d_max)

                pop.append([float(s_val), float(t_val), float(d_val)])


        pop = np.array(pop)

        n = self.pop_size
        fitness_vals = np.array([self.calculate_fitness(ind) for ind in pop])
        best_idx = int(np.argmax(fitness_vals))
        self.best_fitness = fitness_vals[best_idx]
        self.best_position = pop[best_idx].copy()
        stagnation_counter = 0
        previous_best = self.best_fitness
        while stagnation_counter < self.max_stagnation:

            for j in range(self.pop_size):
                candidates = [candidate for candidate in range(self.pop_size) if candidate != j]
                a, b, c = pop[choice(candidates, 3, replace=False)]
                mutated = self.mutation([a, b, c])
                mutated = self.clip_position(mutated)
                trial = self.crossover(mutated, pop[j])
                trial = self.clip_position(trial)

                #print(f"trial: {trial}")
                
                # SAVED ALL RECORDS
                dummy_fit, dummy_script, dummy_trans, dummy_demo = fitness.calculate_3d_fitness(trial[0], trial[1], trial[2])
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

                obj_target = fitness_vals[j]
                obj_trial = self.calculate_fitness(trial)
                n += 1
                if obj_trial > obj_target:
                    pop[j] = trial
                    fitness_vals[j] = obj_trial
                    if obj_trial > self.best_fitness:
                        self.best_fitness = obj_trial
                        self.best_position = np.array(trial)

            if self.best_fitness - previous_best > self.tolerance:
                stagnation_counter = 0
                previous_best = self.best_fitness
            else:
                stagnation_counter += 1

        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )
        

        # Collect the final status of the entire DE population
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

if __name__ == "__main__":

    auditor = DEAuditor()
    result = auditor.run_de()