# UC025 Quantum Secure Chat Platform — Render Deployment Guide

This guide explains how to deploy the entire **UC025 Real Dynamic E91 Quantum Key Distribution & Secure Chat Platform** on [Render](https://render.com).

---

## 🏗️ Architecture Overview

The platform is designed to deploy cleanly into **2 coordinated Render Web Services** (or 3 if decoupling the static frontend):

```
                                 [ Browser Client ]
                                         │
                                         ▼ HTTPS / WSS
               ┌──────────────────────────────────────────────────┐
               │    qkd-chat-platform (Node.js + React Full-Stack) │
               │   • Port: $PORT (provided by Render)             │
               │   • Serves React SPA (Vite production build)     │
               │   • REST Endpoints (/api/auth, /api/session, …)  │
               │   • Socket.IO WebSocket Engine (/socket.io)      │
               └──────────────────────────────────────────────────┘
                                         │
                         QUANTUM_ENGINE_URL (HTTPS / WSS)
                                         ▼
               ┌──────────────────────────────────────────────────┐
               │    quantum-engine (Python 3.11 + FastAPI + Qiskit)│
               │   • Port: $PORT (provided by Render)             │
               │   • Real Qiskit E91 Bell Pair Simulations        │
               │   • Live Round-by-Round WS Streaming             │
               │   • Quantum CHSH Inequality & QBER Detection     │
               └──────────────────────────────────────────────────┘
                                         │
                                (Optional DATABASE_URL)
                                         ▼
                          [ Render Managed PostgreSQL ]
```

---

## 🚀 Method 1: 1-Click Render Blueprint (Recommended)

The repository includes a ready-to-use [`render.yaml`](file:///Users/anjalisimmalapudi/Desktop/proj/render.yaml) specification file.

### Step 1: Push Repository to GitHub
If you haven't already created a GitHub repository:
```bash
# In the project directory (/Users/anjalisimmalapudi/Desktop/proj):
git remote add origin https://github.com/<your-github-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render
1. Open [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top right, then select **Blueprint**.
3. Connect your GitHub account and choose the repository you just pushed.
4. Render will automatically detect [`render.yaml`](file:///Users/anjalisimmalapudi/Desktop/proj/render.yaml) and parse both services:
   - `quantum-engine` (Python Web Service)
   - `qkd-chat-platform` (Node Full-Stack Web Service)
5. Click **Apply**.
6. Render will build and deploy both services concurrently. Once ready, open the URL generated for `qkd-chat-platform` (e.g. `https://qkd-chat-platform.onrender.com`) in your browser.

---

## 🛠️ Method 2: Manual Dashboard Setup (Step-by-Step)

If you prefer to configure services manually in the Render dashboard:

### Service 1: Deploy Python Quantum Engine
1. In Render Dashboard, click **New +** ➔ **Web Service**.
2. Select your GitHub repository.
3. Configure the following fields:
   - **Name**: `quantum-engine`
   - **Region**: Choose any (e.g., `Oregon (US West)` or `Frankfurt (EU)`)
   - **Branch**: `main`
   - **Root Directory**: `quantum-engine`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn api:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`
4. Under **Advanced** ➔ **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.8`
5. Under **Health Check Path**: `/health`
6. Click **Create Web Service**.
7. Wait 2–3 minutes for deployment to complete. Copy the assigned URL (e.g., `https://quantum-engine-xxxx.onrender.com`).

---

### Service 2: Deploy Full-Stack Node/React Chat App
1. In Render Dashboard, click **New +** ➔ **Web Service**.
2. Select the same GitHub repository.
3. Configure the following fields:
   - **Name**: `qkd-chat-platform`
   - **Region**: Same region as Service 1
   - **Branch**: `main`
   - **Root Directory**: *(leave blank or `.`, repository root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. Under **Advanced** ➔ **Environment Variables**:
   - `NODE_ENV`: `production`
   - `QUANTUM_ENGINE_URL`: `https://quantum-engine-xxxx.onrender.com` *(paste URL from Service 1)*
5. Under **Health Check Path**: `/health`
6. Click **Create Web Service**.

---

### (Optional) Service 3: Managed PostgreSQL Database
The application includes an **automatic in-memory fallback store**, so PostgreSQL is 100% optional. If you want persistent historical data:
1. In Render Dashboard, click **New +** ➔ **PostgreSQL**.
2. **Name**: `qkd-postgres`
3. **Plan**: `Free`
4. Copy the **Internal Database URL**.
5. Add `DATABASE_URL` as an environment variable to `qkd-chat-platform`. The application will automatically initialize all tables on startup.

---

## 🔍 Verification & Health Checks

Once deployed, verify each component:

1. **Quantum Engine Health**:
   Visit `https://<quantum-engine-url>/health`
   Expected response:
   ```json
   {"status":"ok","service":"quantum-engine"}
   ```

2. **Backend API Health**:
   Visit `https://<qkd-chat-platform-url>/health`
   Expected response:
   ```json
   {"status":"ok","service":"qkd-backend","timestamp":"..."}
   ```

3. **Open the Web Application**:
   Visit `https://<qkd-chat-platform-url>/`
   - Click **Demo Account Alice** or **Demo Account Bob** to log in.
   - Click **Create Quantum Channel** to watch the real-time Qiskit 2-qubit circuit simulation with Hadamard & CNOT entangling gates, basis rotation angles, and photon pulses.
   - Send quantum-encrypted AES-GCM messages.
   - Toggle **Inject Eve** to verify Bell inequality violation ($S < 2$) and eavesdropping interception detection.

