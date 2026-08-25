import numpy as np
import math
import random
import fitness

class WOAAuditor:

    def __init__(self, metadata_logs=None, num_whales = 5, max_iter=15):
        """
        Initializes the WOA Auditor with a 3D search space.
        :param metadata_logs: Optional list of dictionaries representing the JSONB logs.
                              If None, will fetch from PostgreSQL database.
        :param num_whales: Population size of search agents.
        :param max_iter: Maximum number of search iterations.
        """

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

if __name__ == "__main__":

    auditor = WOAAuditor()