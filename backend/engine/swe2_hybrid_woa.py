"""
PROGRAM TITLE:
    PROBA: Whale Optimization Algorithm (WOA) Module

PROGRAMMERS:
    Gonzales, Eujen C.
    Silvor, Cyrus C.
    
WHERE PROGRAM FITS IN GENERAL SYSTEM DESIGN:
    Component: Backend Algorithmic Core (Process Layer)
    System Role:
        Acts as the primary Stage 1 (Global Exploration) engine in the PROBA
        (Provenance-based Bias Auditor) closed-loop pipeline. Consumes the
        discrete 3D metadata provenance generated during data preprocessing
        (Stage 0), executes a stochastic multi-swarm global search across
        pipeline scripts, transformations, and demographic subgroups, and
        passes candidate global seeds to Differential Evolution (DEAuditor)
        for Stage 2 (Local Exploitation / Refinement).

DATE WRITTEN AND REVISED:
    - Date Written: June 6, 2026
    - Date Revised: October 11, 2026

PURPOSE:
    To explore a combinatorial discrete 3D search space    
    and uncover silent demographic disparities by maximizing a compound
    fairness objective.
    Employs script-preserving multi-swarm partitioning and periodic long-range
    demographic jumps to avoid local optima entrapment.

DATA STRUCTURES, ALGORITHMS, AND CONTROLS:
    Data Structures:
        - numpy.ndarray: Continuous coordinate vectors of shape (3,) and
          swarm population position matrices of shape (N, 3).
        - dict: Search space mappings, transformation boundaries, demographic
          pools, sub-swarm script/transformation leaders, and telemetry logs.
        - list: Script index sequences, candidate seeds, and bias records.
        - tuple: Discrete 3D coordinate keys and boundary limits.
    Algorithms:
        - Whale Optimization Algorithm (WOA) by Mirjalili & Lewis (2016).
        - Encircling Prey Mechanism (|A| < 1.0, p < 0.5).
        - Bubble-Net Spiral Attack (p >= 0.5, logarithmic spiral).
        - Random Prey Exploration (|A| >= 1.0, p < 0.5).
        - Script-Preserving Multi-Swarm Partitioning (Sub-Swarm Confinement).
        - Stochastic Long-Range Demographic Jump Mutation (p < 0.15).
    Controls:
        - Iteration loops over generations (max_iter) and agents (num_whales).
        - Probabilistic branching conditions (p < 0.5, |A| < 1.0).
        - Strict boundary guard rails and exception handling for search spaces.
"""

import math
import random
import numpy as np
import fitness
from hybrid_de import DEAuditor

# Module-Level Constants
DEFAULT_NUM_WHALES: int = 30
DEFAULT_MAX_ITER: int = 30


class WOAAuditor:
    """Whale Optimization Algorithm global exploration bias auditor."""

    DEFAULT_NUM_WHALES: int = DEFAULT_NUM_WHALES
    DEFAULT_MAX_ITER: int = DEFAULT_MAX_ITER

    def __init__(self, metadata_logs = None, num_whales = DEFAULT_NUM_WHALES,
                 max_iter = DEFAULT_MAX_ITER, de_params = None):
        """Initializes hyper-parameters, space bounds, and state storage."""
        self.num_whales = int(num_whales)
        self.max_iter = int(max_iter)
        self.metadata_logs = metadata_logs
        self.de_params = de_params or {}
        self._load_search_space(metadata_logs)
        self.dim = 3
        self.best_position = np.zeros(self.dim, dtype=float)
        self.best_fitness = float("-inf")
        self.all_biases = []

    def _load_search_space(self, logs):
        """Extracts and validates discrete search dimensions from metadata."""
        dims = fitness.get_space_dimensions(logs)
        self.scripts, self.transformations, self.demographics = dims
        if not self.scripts:
            raise ValueError(
                "Search space failure: No provenance logs available."
            )

    def _get_script_index(self, pos_s: float) -> int:
        """Clips and rounds floating coordinate to valid script index."""
        max_limit = max(0, len(self.scripts) - 1)
        return int(round(np.clip(pos_s, 0, max_limit)))

    def _get_trans_index(self, s_idx: int, pos_t: float) -> int:
        """Clips and rounds coordinate to valid transformation index."""
        s_name = self.scripts[s_idx]
        t_list = self.transformations.get(s_name, [])
        return int(round(np.clip(pos_t, 0, max(0, len(t_list) - 1))))

    def _get_demo_index(self, s_idx: int, t_idx: int, pos_d: float) -> int:
        """Clips and rounds coordinate to valid demographic group index."""
        s_name = self.scripts[s_idx]
        t_list = self.transformations.get(s_name, [])
        t_name = t_list[t_idx] if t_list else "None"
        d_list = self.demographics.get((s_name, t_name), [])
        return int(round(np.clip(pos_d, 0, max(0, len(d_list) - 1))))

    def clip_position(self, pos: np.ndarray) -> np.ndarray:
        """Bounds continuous coordinates to discrete 3D domain limits."""
        if not self.scripts:
            return np.zeros(self.dim, dtype=float)
        # WOA operates in continuous space, but our pipeline space is discrete.
        s = self._get_script_index(pos[0])
        t = self._get_trans_index(s, pos[1])
        d = self._get_demo_index(s, t, pos[2])
        # Return as floats so numpy vector math in WOA continues to work smoothly
        return np.array([float(s), float(t), float(d)], dtype=float)

    def calculate_fitness(self, pos: np.ndarray) -> float:
        """Computes fitness objective score for a given 3D position."""
        score, _, _, _ = fitness.calculate_3d_fitness(
            pos[0], pos[1], pos[2]
        )
        return float(score)

    def _init_single_whale(self, s_idx: int) -> list:
        """Randomly generates initial coordinate within assigned script."""
        s_name = self.scripts[s_idx]
        t_list = self.transformations.get(s_name, [])
        t_val = random.randint(0, max(0, len(t_list) - 1))
        t_name = t_list[t_val] if t_list else "None"
        d_list = self.demographics.get((s_name, t_name), [])
        d_val = random.randint(0, max(0, len(d_list) - 1))
        return [float(s_idx), float(t_val), float(d_val)]

    def _build_initial_swarm(self, per_script: int) -> np.ndarray:
        """Constructs partitioned swarm coordinate array across scripts."""
        coords = []
        for s in range(len(self.scripts)):       
            for _ in range(per_script):         
                whale = self._init_single_whale(s)
                coords.append(whale)

        return np.array(coords, dtype=float)

    def _init_transformation_bests(self):
        """Initializes best candidate trackers per transformation stage."""
        self.script_bests, self.transformation_bests = {}, {}
        for s_idx, s_name in enumerate(self.scripts):
            t_list = self.transformations.get(s_name, [])
            for t_idx, _ in enumerate(t_list):
                pos = self.clip_position(np.array([s_idx, t_idx, 0.0]))
                fit = self.calculate_fitness(pos)
                self.transformation_bests[(s_idx, t_idx)] = {
                    "fitness": fit, "position": pos.copy()
                }

    def _init_script_bests(self):
        """Derives initial sub-swarm leader per pipeline script."""
        for (s_idx, _), entry in self.transformation_bests.items():
            if s_idx not in self.script_bests:
                self.script_bests[s_idx] = entry.copy()
            elif entry["fitness"] > self.script_bests[s_idx]["fitness"]:
                self.script_bests[s_idx] = entry.copy()

    def _evaluate_agent(self, whales_pos: np.ndarray, i: int):
        """Evaluates fitness for a whale and updates sub-swarm leaders."""
        whales_pos[i] = self.clip_position(whales_pos[i])
        score = self.calculate_fitness(whales_pos[i])
        s_idx = int(round(whales_pos[i][0]))
        t_idx = int(round(whales_pos[i][1]))
        self._update_leaders(s_idx, t_idx, score, whales_pos[i])

    def _update_leaders(self, s: int, t: int, fit: float, pos: np.ndarray):
        """Updates transformation-level, script-level, and global bests."""
        if (s, t) in self.transformation_bests:
            if fit > self.transformation_bests[(s, t)]["fitness"]:
                self.transformation_bests[(s, t)] = {
                    "fitness": fit, "position": pos.copy()
                }
        self._update_script_and_global(s, fit, pos)

    def _update_script_and_global(self, s: int, fit: float, pos: np.ndarray):
        """Updates script sub-swarm leader and overall best solution."""
        if s in self.script_bests and fit > self.script_bests[s]["fitness"]:
            self.script_bests[s] = {"fitness": fit, "position": pos.copy()}
        if fit > self.best_fitness:
            self.best_fitness = fit
            self.best_position = pos.copy()

    def _compute_random_jump(self, s_idx: int) -> np.ndarray:
        """Executes exploratory jump to random demographic subspace."""
        s_name = self.scripts[s_idx]
        t_list = self.transformations.get(s_name, [])
        t_rand = random.randint(0, max(0, len(t_list) - 1))
        t_name = t_list[t_rand] if t_list else "None"
        d_list = self.demographics.get((s_name, t_name), [])
        d_rand = random.randint(0, max(0, len(d_list) - 1))
        return np.array([float(s_idx), float(t_rand), float(d_rand)])

    def _compute_encircle_step(self, lead: np.ndarray, cur: np.ndarray,
                               a_param: float) -> np.ndarray:
        """Calculates position update towards prey via encircling."""
        # a_vec (A in WOA) controls step direction and distance.
        a_vec = 2.0 * a_param * random.random() - a_param
        # c_vec (C in WOA) provides stochastic weighting to scale the leader's attraction
        c_vec = 2.0 * random.random()
        # Distance vector between current whale position and the best leader position
        dist = np.abs(c_vec * lead - cur)
        # Move whale towards the leader, scaled by step vector a_vec
        return lead - a_vec * dist

    def _compute_search_step(self, r_agent: np.ndarray, cur: np.ndarray,
                             a_param: float) -> np.ndarray:
        """Calculates exploratory position update towards random peer."""
        # This forces the whale to explore other regions when |A| >= 1.0.
        a_vec = 2.0 * a_param * random.random() - a_param
        c_vec = 2.0 * random.random()
        dist = np.abs(c_vec * r_agent - cur)
        return r_agent - a_vec * dist

    def _compute_spiral_step(self, lead: np.ndarray,
                             cur: np.ndarray) -> np.ndarray:
        """Calculates logarithmic spiral bubble-net attack path."""
        dist = np.abs(lead - cur)
        # l_param determines how tight or wide the spiral is around the leader
        l_param = random.uniform(-1.0, 1.0)
        # Logarithmic spiral equation simulating a 3D helix path towards prey
        spiral = math.exp(1.0 * l_param) * math.cos(
            2.0 * math.pi * l_param
        )
        # Update position along the spiral path towards the leader
        return dist * spiral + lead

    def _pick_random_peer(self, whales: np.ndarray, s_idx: int,
                          per_script: int) -> np.ndarray:
        """Selects a random peer agent from the same script sub-swarm."""
        # Find the sub-swarm slice for this script to pick a neighbor from the same pipeline
        start_idx = s_idx * per_script
        rand_offset = random.randint(0, per_script - 1)
        return whales[start_idx + rand_offset]

    def _compute_hunting_vector(self, whales: np.ndarray, i: int,
                                s_idx: int, a_val: float, per_s: int):
        """Determines movement vector based on stochastic hunting mode."""
        lead = self.script_bests[s_idx]["position"]
        cur = whales[i]
        # 50% probability mechanism between encircling/searching vs bubble-net spiral attack
        if random.random() < 0.5:
            # When |A| < 1.0: exploitation phase (shrink circle around the leader)
            if abs(2.0 * a_val * random.random() - a_val) < 1.0:
                return self._compute_encircle_step(lead, cur, a_val)
            # When |A| >= 1.0: exploration phase (diverge and follow a random peer)
            peer = self._pick_random_peer(whales, s_idx, per_s)
            return self._compute_search_step(peer, cur, a_val)
        # p >= 0.5: bubble-net spiral attack path towards the leader
        return self._compute_spiral_step(lead, cur)

    def _record_telemetry(self, pos: np.ndarray, t_step: int, callback):
        """Records telemetry bias log entry and notifies client callback."""
        fit, script, trans, demo = fitness.calculate_3d_fitness(
            pos[0], pos[1], pos[2]
        )
        entry = {"fitness_score": fit, "script_name": script,
                 "transformation_name": trans, "demographic_group": demo}
        self.all_biases.append(entry)
        self._dispatch_callback(callback, t_step, entry)

    def _dispatch_callback(self, callback, t_step: int, entry: dict):
        """Dispatches live progress event to streaming listener."""
        if not callback:
            return
        payload = {
            "stage": "WOA", "iteration": t_step + 1,
            "step": len(self.all_biases), "best_fitness": self.best_fitness,
            **entry
        }
        callback(payload)

    def _update_single_whale_pos(self, whales: np.ndarray, i: int,
                                 a_val: float, t: int, per_s: int, cb):
        """Updates and clips position vector for a single whale agent."""
        # Identify which script sub-swarm this whale belongs to.
        s_idx = i // per_s
        # 15% chance mutation during early/mid iterations (first 70%) to jump to a random
        if random.random() < 0.15 and t < self.max_iter * 0.7:
            whales[i] = self._compute_random_jump(s_idx)
            return
        new_pos = self._compute_hunting_vector(whales, i, s_idx, a_val, per_s)
        # Lock the script index so this sub-swarm strictly audits its assigned script
        new_pos[0] = float(s_idx)
        whales[i] = self.clip_position(new_pos)
        self._record_telemetry(whales[i], t, cb)

    def _run_iteration(self, whales: np.ndarray, t: int, per_s: int, cb):
        """Executes a single generational evaluation and hunting epoch."""
        for i in range(len(whales)):
            self._evaluate_agent(whales, i)
        # Linearly decay a_param from 2.0 down to 0.0 across iterations.
        a_param = 2.0 - (float(t) * (2.0 / float(self.max_iter)))
        for i in range(len(whales)):
            self._update_single_whale_pos(whales, i, a_param, t, per_s, cb)

    def core_algo(self, whales_pos: np.ndarray, callback=None) -> np.ndarray:
        """Executes main WOA generational search over all sub-swarms."""
        whales_per_script = max(1, len(whales_pos) // len(self.scripts))
        self._init_transformation_bests()
        self._init_script_bests()
        for t in range(self.max_iter):
            self._run_iteration(whales_pos, t, whales_per_script, callback)
        return self.best_position

    def run_woa(self, callback=None) -> dict:
        """Initializes swarm, runs exploration, and delegates to DE."""
        self.all_biases = []
        per_script = max(1, self.num_whales // len(self.scripts))
        whales_pos = self._build_initial_swarm(per_script)
        self.best_position = self.core_algo(whales_pos, callback = callback)
        # Extract the best discovered position for each transformation stage as seeds.
        seeds = [v["position"] for v in self.transformation_bests.values()]
        de_auditor = DEAuditor(self.metadata_logs, **self.de_params)
        res = de_auditor.run_de(seed_positions = seeds, all_biases = self.all_biases, callback = callback)
        res["all_biases"] = self.all_biases
        return res


if __name__ == "__main__":
    auditor = WOAAuditor()
    results = auditor.run_woa()
    #print("Optimization finished:", results)
