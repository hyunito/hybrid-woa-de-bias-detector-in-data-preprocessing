# Demographic Bias Auditing Baseline (WOA)

This repository implements a data preprocessing pipeline combined with an auditing tool designed to detect demographic bias propagation across data transformations. It uses a **Whale Optimization Algorithm (WOA)** agent to scan intersectional demographic combinations and identify hidden bias hotspots within the data pipeline steps.

---

## Prerequisites & Installation

To run the pipeline and GUI, ensure you have Python 3.x installed. 

Install the required Python libraries using pip:
```bash
pip install pandas python-dotenv psutil numpy
```
*(Note: Database connections are commented out; the system operates directly on local metadata logs, so PostgreSQL is not required.)*

---

## How it Works

### 1. Data Preprocessing Pipeline
Running the pipeline processes the raw sample dataset through standard cleaning operations and records metadata for auditability.

```bash
python main.py
```

This command will:
1. Load `data/raw/dirty_ACSIncome_2018_100K.csv`.
2. Run data through three stages:
   * **Step 1:** Remove Duplicates & Fix Formatting.
   * **Step 2:** Handle Missing Values, Missing Rows, and Drop missing target labels.
   * **Step 3:** Remove Numerical and Categorical Outliers.
3. Automatically capture demographic snapshots (selection rates, positive outcomes) at each step.
4. Export the resulting provenance records to `data/provenance_metadata.json`.

### 2. Whale Optimization Algorithm (WOA) Auditor
To run the WOA search agent to locate bias hotspots:

```bash
python src/models/woa.py
```

This auditor reads the logs directly from `data/provenance_metadata.json` and uses the WOA algorithm to optimize a fitness function representing demographic bias (selection rate disparity). It reports the demographic group and step experiencing the highest relative bias.

### 3. Graphical User Interface (GUI)
You can run the interactive desktop app to visual and run the pipeline/audits:

```bash
python gui.py
```

The GUI allows you to:
- Browse and select the input dataset (defaulting to the sample dataset).
- Run the preprocessing pipeline steps sequentially.
- Trigger the WOA Search to scan the generated provenance file.
- View real-time graphs showing the highest bias hotspots detected across the preprocessing stages.

---
