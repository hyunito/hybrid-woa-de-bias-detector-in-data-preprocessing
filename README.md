# Demographic Bias Auditing Using Whale Optimization Algorithm, Differential Evolution, and Hybrid WOA-DE Algorithms

This repository implements a data preprocessing pipeline combined with an auditing tool designed to detect demographic bias propagation across data transformations. It uses a **Whale Optimization Algorithm (WOA)**, **Differential Evolution (DE)**, and **Hybrid WOA-DE** algorithms to scan intersectional demographic combinations and identify hidden bias hotspots within data pipeline steps.

---

## Prerequisites

Before running the project, verify that the following dependencies are installed on your machine:
* **[Python 3.10+](https://www.python.org/downloads/)**
* **[Node.js (v18 or higher)](https://nodejs.org/)** and **npm**
* **PostgreSQL** (optional)

---


## Setup and Installation Guide

### 1. Backend Setup

From the repository root, install the required Python packages:

```bash
pip install fastapi "uvicorn[standard]" websockets python-multipart pydantic pandas numpy psycopg2-binary psutil python-dotenv folktables ipykernel
```


### 2. Frontend Setup

From the repository root, navigate into the frontend directory and install dependencies:

```bash
cd frontend
npm install
npm run dev
```

Once started, open your browser and navigate to:
**[http://localhost:5173](http://localhost:5173)**


