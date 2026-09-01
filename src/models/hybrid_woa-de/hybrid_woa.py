import numpy as np
import math
import random
import fitness

class WOAAuditor:

    def __init__(self, metadata_logs=None, num_whales = 30, max_iter=15):

        self.num_whales = num_whales
        self.max_iter= max_iter 
       
        self.script, self.transformation, self.demographics = fitness.get_space_dimensions()
        if not self.script:
            print("Couldn't run the algorithm. No search log found.")
            return

        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

    def run_audit(self):
        whale_pos = []
        for _ in range(self.num_whales):
            s_val = random.randint(0, len(self.script) - 1)
            script_name = self.script[s_val]

            t_max = len(self.transformations.get(script_name, []))

    def clip_position(self, pos):
        
        s = int(round(np.clip(pos[0], 0, len(self.scripts) - 1)))
        script_name = self.scripts[s]

        t_max = len(self.transformations.get(script_name, [])) - 1
        t_max = max(0, t_max)
        t = int(round(np.clip(pos[1], 0, t_max)))

        trans_list = self.transformation.get(script_name, [])
        trans_name = trans_list[t] if trans_list else "None"

        d_max = len(self.demographics.get((script_name, trans_name), [])) - 1
        d_max = max(0, d_max)
        
        d = int(round(np.clip(pos[2], 0, d_max)))

        return np.array([float(s), float(t), float(d)])

    def run_audit(self):
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
        self.best_fitness = 0
        self.best_position = whales_pos[0].copy()
        b = 1
        for t in range(self.max_iter):
            a = 2.0 - (2.0 * t / self.max_iter)
            for i in range(self.num_whales):
                score, _, _, _ = fitness.calculate_3d_fitness(whales_pos[i, 0], whales_pos[i, 1], whales_pos[i, 2])
                if score > self.best_fitness:
                    self.best_fitness = score
                    self.best_position
                
                r1 = random.random()
                r2 = random.random()

                p = random.random()

                if p < 0.5:
                    A = 2 * a * r1 - a
                    C = 2 * r2
                    # Encircling property
                    if abs(A) < 1:
                        D = abs(C * self.best_position - whales_pos[i])
                        new_pos = self.best_position - A * D
                    else:
                        # Search for prey (random search agent selection)
                        random_whale_idx = random.randint(0, self.num_whales - 1)
                        random_whale = whales_pos[random_whale_idx]
                        D = abs(C * random_whale - whales_pos[i])
                        new_pos = random_whale - A * D
                else: 
                    l = random.uniform(-1, 1)
                    # Spiral bubble-net attack
                    D_prime = abs(self.best_position - whales_pos[i])
                    new_pos = D_prime * math.exp(b * 1) * math.cos(2 * math.pi * l) + self.best_position
                
                whales_pos[i] = self.clip_position(new_pos)

        best_fitness, best_script, best_trans, best_demo = fitness.calculate_3d_fitness(
            self.best_position[0], self.best_position[1], self.best_position[2]
        )
if __name__ == "__main__":

    auditor = WOAAuditor()