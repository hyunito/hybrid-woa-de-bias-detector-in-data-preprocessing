import numpy as np
import math
import random
import fitness
correct = 0
class WOAAuditor:
    
    def __init__(self, metadata_logs=None, num_whales=30, max_iter=15):
        """
        Initializes the WOA Auditor with a 3D search space.
        :param metadata_logs: Optional list of dictionaries representing the JSONB logs.
                              If None, will fetch from PostgreSQL database.
        :param num_whales: Population size of search agents.
        :param max_iter: Maximum number of search iterations.
        """
        self.num_whales = num_whales
        self.max_iter = max_iter
        
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
        #print(f"Clipping Results: {np.array([float(s), float(t), float(d)])}")
        return np.array([float(s), float(t), float(d)])

    def calculate_fitness(self, pos, n):
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

        whales_pos = []
        for _ in range(self.num_whales):
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
            
            whales_pos.append([float(s_val), float(t_val), float(d_val)])
            
            
        whales_pos = np.array(whales_pos)
        print("Accessing Array:")
        print(whales_pos)
        print("Accessing Specific Array:")
        print(whales_pos[0,0])
        print(whales_pos[0,1])
        print(whales_pos[0,2])
        
        self.best_fitness = float('-inf')
        self.best_position = whales_pos[0].copy()
        n = 1
        for t in range(self.max_iter):
           
            for i in range(self.num_whales):
                
                whales_pos[i] = self.clip_position(whales_pos[i])
                score = self.calculate_fitness(whales_pos[i], n)
                n = n+1
                if score > self.best_fitness:
                    self.best_fitness = score
                    self.best_position = whales_pos[i].copy()
                
                
            
            _, curr_script, _, _ = fitness.calculate_3d_fitness(
                self.best_position[0], self.best_position[1], self.best_position[2]
            )
            
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
                        # Encircling prey
                        D = abs(C * self.best_position - whales_pos[i])
                        new_pos = self.best_position - A * D
                    else:
                        # Search for prey (random search agent selection)
                        random_whale_idx = random.randint(0, self.num_whales - 1)
                        random_whale = whales_pos[random_whale_idx]
                        D = abs(C * random_whale - whales_pos[i])
                        new_pos = random_whale - A * D
                else:
                    # Spiral bubble-net attack
                    D_prime = abs(self.best_position - whales_pos[i])
                    b = 1 
                    new_pos = D_prime * math.exp(b * l) * math.cos(2 * math.pi * l) + self.best_position
                
                whales_pos[i] = self.clip_position(new_pos)
        global correct
        traceability = correct / (n-1)
        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )
        
        # Collect the final status of the entire whale population
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
        
        return {
            "max_fitness_score": best_fitness,
            "script_name": best_script,
            "transformation_name": best_trans,
            "demographic_group": best_demo,
            "whales": whales_info,
            "traceability": traceability
        }

if __name__ == "__main__":
    
    auditor = WOAAuditor()
    result = auditor.run_audit()
 
    
