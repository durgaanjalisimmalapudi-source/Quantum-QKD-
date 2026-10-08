# UC025 — Dynamic E91 QKD Secure Communication Platform

A complete, production-grade platform demonstrating **secure quantum key distribution (QKD)** and **authenticated encrypted communication** between critical-infrastructure sites (e.g. electrical substations, control centers), powered by the **dynamic E91 (Ekert 91) protocol** with **per-round Bell-inequality verification** and eavesdropping detection.

---

## 🌟 Key Features & Core Differentiators

1. **True Per-Round Bell-Inequality & QBER Telemetry**:
   - Rather than calculating statistics at the end of a multi-thousand-bit block, CHSH $S$-parameter and Quantum Bit Error Rate (QBER) are dynamically updated and streamed **every single round**.
   - Quantum regime violation: $S \approx 2.8284 > 2.0$.
   - Classical limit / eavesdropping bound: $S \le 2.0$, QBER $> 11\%$.

2. **Simulated Intercept-Resend Eavesdropping (Eve)**:
   - Real-time simulation of an active eavesdropper intercepting Bob's entangled photon channel.
   - Triggers instantaneous anomaly alerts (`eavesdrop_alert`), drops $S$ below the classical bound of $2.0$, spikes QBER to $\sim 25\%$, and visibly discards compromised key material.

3. **In-Memory Ephemeral Key Store & Hard Privacy Guarantee**:
   - Raw QKD-derived keys are **NEVER** stored in PostgreSQL, on disk, or in log files.
   - Keys live solely in the Node backend's RAM with automatic TTL eviction.
   - Text messages are encrypted with **AES-256-GCM** (authenticated encryption with 12-byte IV and 16-byte auth tag).
   - Only ciphertext, IV, and authentication tag are recorded in PostgreSQL `message_logs`.

4. **Live React Dashboard**:
   - Visual two-site terminal view (Site A / Site B).
   - Real-time SVG chart showing live CHSH $S$ curve and QBER curve against critical thresholds.
   - Live Eavesdropper toggle.
   - Authenticated encrypted chat console demonstrating ciphertext transmission and recipient-side decryption.
   - PostgreSQL session history and audit log.

---

## 📐 System Architecture & Protocols

```
┌─────────────────────────────────┐           ┌────────────────────────────────┐
│   React Frontend (Vite :3000)   │ ◄───────► │   Node.js / Express (:5000)    │
│  - Live Telemetry & Bell Chart  │  REST &   │  - Session Orchestrator        │
│  - Two-Site Terminal Dash       │ Socket.IO │  - In-Memory Key Store         │
│  - Authenticated Chat Console   │           │  - AES-256-GCM Cryptography    │
└─────────────────────────────────┘           └──────────────┬─────────────────┘
                                                             │
                              ┌──────────────────────────────┼─────────────────────────────┐
                              ▼                              ▼                             ▼
               ┌─────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
               │    FastAPI Quantum Engine   │ │     PostgreSQL Database   │ │    Socket.IO Relay Server │
               │          (Port 8000)        │ │         (qkd_platform)    │ │  - round_stats            │
               │  - Qiskit Entangled Pairs   │ │  - sessions               │ │  - eavesdrop_alert        │
               │  - Per-Round QBER / CHSH    │ │  - round_logs             │ │  - key_ready              │
               │  - Eve Intercept-Resend     │ │  - message_logs           │ │  - encrypted_message      │
               └─────────────────────────────┘ └───────────────────────────┘ └───────────────────────────┘
```

### E91 Protocol Measurement Angles
- **Entangled Bell State**: $|\Phi^+\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}$
- **Alice's Measurement Angles**: $a_1 = 0$, $a_2 = \pi/4$, $a_3 = \pi/2$
- **Bob's Measurement Angles**: $b_1 = \pi/4$, $b_2 = \pi/2$, $b_3 = 3\pi/4$
- **Matching Bases (Key Generation)**: $(a_2, b_1)$ and $(a_3, b_2)$ ($\theta_A = \theta_B \implies \text{QBER} = 0\%$)
- **CHSH Bell Test Pairs**: $(a_1, b_1)$, $(a_1, b_3)$, $(a_3, b_1)$, $(a_3, b_3) \implies S = |E_{11} - E_{13} + E_{31} + E_{33}| = 2\sqrt{2} \approx 2.8284$

---

## 📂 Project Structure

```
qkd-platform/
├── quantum-engine/            # Python 3 + Qiskit 2.x + FastAPI
│   ├── e91_protocol.py        # Core protocol: Bell pairs, basis selection, key sifting
│   ├── qber_chsh.py           # Per-round QBER and CHSH(S) computation
│   ├── eve_simulator.py       # Intercept-resend quantum eavesdropper simulation
│   ├── api.py                 # FastAPI service: HTTP + WebSocket streaming
│   ├── test_standalone.py     # Standalone physics verification script
│   ├── test_api.py            # FastAPI & WebSocket verification script
│   └── requirements.txt       # Dependencies (qiskit, fastapi, uvicorn, numpy)
├── backend/                   # Node.js + Express + PostgreSQL
│   ├── server.js              # Express & HTTP server
│   ├── socket.js              # Socket.IO streaming setup
│   ├── routes/
│   │   ├── session.js         # REST endpoints for session lifecycle
│   │   └── message.js         # REST endpoints for encrypted chat
│   ├── services/
│   │   ├── quantumEngineClient.js # HTTP & WS client for Python engine
│   │   ├── cryptoService.js       # AES-256-GCM authenticated encryption/decryption
│   │   └── sessionKeyStore.js     # Ephemeral in-memory key storage with TTL
│   ├── db/
│   │   ├── client.js          # PostgreSQL node-postgres (pg) client
│   │   └── schema.sql         # Database schema DDL
│   ├── test_db.js             # Database CRUD verification
│   ├── test_crypto.js         # Cryptographic verification
│   ├── test_integration.js    # Full end-to-end integration test suite
│   └── package.json
├── frontend/                  # React (Vite) Single Page Application
│   ├── src/
│   │   ├── App.jsx            # Main dashboard coordinator
│   │   ├── components/
│   │   │   ├── LiveChart.jsx      # Per-round real-time S and QBER graph
│   │   │   ├── SitePanel.jsx      # Two-site terminal & photon animation
│   │   │   ├── EveToggle.jsx      # Intercept-resend toggle
│   │   │   ├── ChatPanel.jsx      # Encrypted chat console
│   │   │   └── SessionHistory.jsx # PostgreSQL session history audit table
│   │   └── services/
│   │       ├── api.js         # REST API client
│   │       └── socket.js      # Socket.IO client
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml         # Containerized orchestration for all services
└── README.md
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Python 3.10+ (with virtual environment support)
- Node.js 18+ and npm
- PostgreSQL 14+ running locally

### 1. Database Setup
```bash
# Create database
psql -U postgres -c "CREATE DATABASE qkd_platform;"

# Apply schema
psql -U postgres -d qkd_platform -f backend/db/schema.sql
```

### 2. Quantum Engine Setup
```bash
cd quantum-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run standalone verification test
PYTHONPATH=. python test_standalone.py

# Start Quantum Engine API server (port 8000)
uvicorn api:app --host 0.0.0.0 --port 8000
```

### 3. Backend Setup
```bash
cd backend
npm install

# Run database & crypto test suites
node test_db.js
node test_crypto.js

# Start backend server (port 5000)
node server.js
```

### 4. Frontend Setup
```bash
cd frontend
npm install

# Start Vite development server (port 3000)
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 🧪 Comprehensive Verification Suite

Every layer of the system includes dedicated test suites:

| Test Script | Layer Tested | Validation Performed |
|---|---|---|
| `quantum-engine/test_standalone.py` | Quantum Engine (Physics) | Validates $S \approx 2.82$, QBER $\approx 0\%$ without Eve; validates $S < 2.0$, QBER $> 11\%$, and 100% key discarding with Eve. |
| `quantum-engine/test_api.py` | FastAPI & WebSockets | Verifies HTTP `/engine/start`, WebSocket `/engine/ws/{id}` event stream, and `/engine/result/{id}`. |
| `backend/test_db.js` | PostgreSQL DAL | Confirms ACID CRUD on `sessions`, `round_logs`, and `message_logs`. |
| `backend/test_crypto.js` | Cryptography | Verifies AES-256-GCM encryption, decryption, authentication tag tampering rejection, HKDF key derivation, and RAM-only key lifecycle. |
| `backend/test_integration.js` | Full Stack E2E | Tests clean session, Eve injection, Socket.IO live push, chat encryption/decryption, and inspects database tables to prove no raw keys or plaintext messages exist. |

To run the entire verification suite:
```bash
# 1. Physics standalone verification
PYTHONPATH=quantum-engine ./quantum-engine/venv/bin/python3 quantum-engine/test_standalone.py

# 2. Quantum Engine FastAPI test
PYTHONPATH=quantum-engine ./quantum-engine/venv/bin/python3 quantum-engine/test_api.py

# 3. Backend DB test
node backend/test_db.js

# 4. Backend Crypto test
node backend/test_crypto.js

# 5. Full Backend + Quantum Engine integration test
node backend/test_integration.js
```

---

## 🛡️ Security Architecture & Privacy Guarantee

- **Zero-Storage Key Policy**: Raw QKD-derived keys are stored exclusively in non-persisted Node.js memory (`sessionKeyStore.js`). Memory is wiped with `buffer.fill(0)` on expiration or teardown.
- **Zero Plaintext Logs**: Plaintext messages never touch PostgreSQL or persistent storage. Only AES-256-GCM ciphertext, 96-bit random IV, and 128-bit authentication tag are stored.
- **Per-Round Tamper Resistance**: Compromised photon states during an eavesdropping attack are discarded in the same round they are measured, preventing contaminated bits from ever entering the key buffer.

---

## 📄 License
MIT License. Developed for UC025 Critical Infrastructure Quantum Security.

