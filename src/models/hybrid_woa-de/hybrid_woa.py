import numpy as np
import math
import random
import fitness

class WOAAuditor:

    def __init__(self, metadata_logs=None, num_whales = 5, max_iter=15):

        self.num_whales = num_whales
        self.max_iter=max_iter
        if metadata_logs is not None:
            fitness._scripts = []
            fitness._transformations = {}
            fitness._demographics = {}       
        else:
            self.script, self.transformation, self.demographics = fitness.get_space_dimensions()
            if not self.script:
                print("Couldn't run the algorithm. No search log found.")
                return

        self.dim = 3
        self.best_position = np.zeros(self.dim)
        self.best_fitness = float('-inf')

    def clip_position(self, pos):
        if not self.script:
            return np.zeros(self.dim)
        
        s = int(round(np.clip(pos[0], 0, len(self.scripts) - 1)))
        script_name = self.scripts[s]

        t_max = len(self.transformations.get(script_name, [])) - 1
if __name__ == "__main__":

    auditor = WOAAuditor()