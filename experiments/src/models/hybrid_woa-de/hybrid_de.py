import numpy as np
from numpy.random import rand
from numpy.random import choice
import random
import fitness
correct = 0

def mutation(x, F):
    return x[0] + F * (x[1] - x[2])

def crossover(mutated, target, dims, cr):
    p = rand(dims)
    trial = [mutated[i] if p[i] < cr else target[i] for i in range(dims)]
    return trial

class DEAuditor:
    
    def __init__(self, metadata_logs=None, pop_size=30, F=0.5, CR=0.7, tolerance=1e-6, max_stagnation=25):
        """
        Initializes the WOA Auditor with a 3D search space.
        :param metadata_logs: Optional list of dictionaries representing the JSONB logs.
                              If None, will fetch from PostgreSQL database.
        :param pop_size: Population size of search agents.
        """
        self.pop_size = pop_size
        self.F = F
        self.CR = CR
        self.tolerance = tolerance
        self.max_stagnation = max_stagnation
        
        if metadata_logs is not None:
            fitness._scripts = []
            fitness._transformations = {}
            fitness._demographics = {}
            
            for log in metadata_logs:
                script = log.get("script_name", "mock_script.py")
                trans = log.get("transformation_name", "mock_trans")
                
                if script not in fitness._scripts:
                    fitness._scripts.append(script)
                    fitness._transformations[script] = []
                if trans not in fitness._transformations[script]:
                    fitness._transformations[script].append(trans)
                demos = log.get("intersectional_demographics", {})
                fitness._demographics[(script, trans)] = sorted(list(demos.keys()))
                
            self.scripts, self.transformations, self.demographics = fitness._scripts, fitness._transformations, fitness._demographics
            fitness._logs_cache = True
        else:
            
            self.scripts, self.transformations, self.demographics = fitness.get_space_dimensions()
            if not self.scripts:
                print("Couldn't run the algorithm. No search log found.")
                return
            
        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

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
        global correct
    
        score, _, trans_name, _ = fitness.calculate_3d_fitness(pos[0], pos[1], pos[2])
        
        if trans_name == "Num Outlier":
            correct+=1
      
        return score

    def run_audit(self):
        """
        Executes the main WOA Scouting loop over the uneven 3D search space.
        """

        pop = []
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
        fitness_vals = np.array([self.calculate_fitness(ind, n) for ind in pop])
        best_idx = int(np.argmax(fitness_vals))
        self.best_fitness = fitness_vals[best_idx]
        self.best_position = pop[best_idx].copy()
        stagnation_counter = 0
        previous_best = self.best_fitness
        while stagnation_counter < self.max_stagnation:
            
            #This is the part of the DE code
            for j in range(self.pop_size):
                candidates = [candidate for candidate in range(self.pop_size) if candidate != j]
                a, b, c = pop[choice(candidates, 3, replace=False)]
                mutated = mutation([a, b, c], self.F)
                mutated = self.clip_position(mutated)
                trial = crossover(mutated, pop[j], self.dim, self.CR)

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

        global correct
        traceability = correct / (n-1)
        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )
        
        # Collect the final status of the entire whale population
        whales_info = []
        for i in range(self.pop_size):
            w_pos = pop[i]
            w_fit, w_script, w_trans, w_demo = fitness.calculate_3d_fitness(w_pos[0], w_pos[1], w_pos[2])
            whales_info.append({
                "whale_id": i + 1,
                "position": w_pos.tolist(),
                "fitness_score": w_fit,
                "script_name": w_script,
                "transformation_name": w_trans,
                "demographic_group": w_demo
            })
        
        return {
            "max_fitness_score": best_fitness,
            "script_name": best_script,
            "transformation_name": best_trans,
            "demographic_group": best_demo,
            "whales": whales_info,
            "traceability": traceability
        }

if __name__ == "__main__":
    
    auditor = DEAuditor()
    result = auditor.run_audit()
 