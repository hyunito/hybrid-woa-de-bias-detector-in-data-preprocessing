# Demographic Bias Auditing Using Whale Optimization Algorithm, Differential Evolution, and Hybrid WOA-DE Algorithms 

This repository implements a data preprocessing pipeline combined with an auditing tool designed to detect demographic bias propagation across data transformations. It uses a **Whale Optimization Algorithm (WOA)**, **Differential Evolution (DE)**, and **Hybrid WOA-DE** algorithms to scan intersectional demographic combinations and identify hidden bias hotspots within the data pipeline steps.

---

## 📋 Prerequisites

Before running the project, make sure you have the following installed on your machine:
* **[Python 3.10+](https://www.python.org/downloads/)**
* **[Node.js (v18 or higher)](https://nodejs.org/)** and **npm**

---

## 🚀 Quick Start Guide

### 1. Frontend Setup (React + Vite + Tailwind CSS)

When cloning the repository for the first time, you must install the frontend dependencies before starting the dev server:

```bash
# 1. Navigate into the frontend directory
cd frontend

# 2. Install all required dependencies (only required once after cloning)
npm install

# 3. Start the local development server
npm run dev
```

Once started, open your browser and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

---

### 2. Backend Setup (Python)

Install the required Python packages:

```bash
# Navigate to the project root (if you are in frontend, run: cd ..)
pip install pandas python-dotenv psutil numpy folktables ipykernel psycopg2-binary
```