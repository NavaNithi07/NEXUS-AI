# Nexus AI Wallet — Autonomous On-Chain AI Wallet Platform

**FinTechathon 2026 Submission Edition**  
*Decentralized Autonomous Account Abstraction & Institutional Policy Enclave*

---

## 🏆 Competition Deliverables & Evidence Index (Topic F)

| Deliverable | Location | Description |
| :--- | :--- | :--- |
| **Technical Documentation** | [`docs/TECHNICAL_DOCUMENTATION.md`](docs/TECHNICAL_DOCUMENTATION.md) | Comprehensive architecture specification, API contracts, and enclave dataflow. |
| **Security Self-Assessment** | [`docs/SECURITY_ASSESSMENT.md`](docs/SECURITY_ASSESSMENT.md) | Threat model, mitigation matrix, 10-point control audit, and KMS isolation. |
| **Presentation Deck Outline**| [`docs/PRESENTATION_DECK.md`](docs/PRESENTATION_DECK.md) | 10-minute slide outline with live demonstration timing and speaker notes. |
| **Demo Video Script** | [`docs/DEMO_VIDEO_SCRIPT.md`](docs/DEMO_VIDEO_SCRIPT.md) | 5-minute video walkthrough covering zero-trust auth, policy halts, and killswitch. |
| **Evidence Package** | [`docs/EVIDENCE_PACKAGE.md`](docs/EVIDENCE_PACKAGE.md) | Verified test reports, Base Sepolia RPC metrics, and build artifacts. |
| **Final Readiness Report** | [`docs/FINAL_READINESS_REPORT.md`](docs/FINAL_READINESS_REPORT.md) | Comprehensive audit breakdown and verified baseline checklist. |

---

## 1. Architecture & Persistence Engine

Nexus AI Wallet operates on an institutional Enclave Architecture:
- **Frontend SPA (`/src`)**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, and Lucide icons. Runs in a zero-trust mode where private keys and root secrets never touch the browser. All operator actions are authenticated via cryptographic JWT Bearer tokens.
- **Backend Enclave (`/server`)**: Node.js/Express service responsible for:
  - **AI Transaction Intent Planning**: Parses user task goals into structured transaction proposals (action, token, recipient, amount). Default: deterministic rules engine; optional: pluggable LLM.
  - **Multi-Tier Policy Engine**: Enforces single-transaction caps, daily velocity limits, and recipient allowlists before signing.
  - **EIP-1559 Dynamic Gas Protection**: Queries Base Sepolia, applies a +20% safety buffer, and enforces a 100 Gwei hard cap.
  - **Canonical Idempotency Engine**: SHA-256 canonical hashing ensures duplicate requests return cached results, while payload tampering triggers HTTP 409 Conflict.
  - **Authoritative Persistence Engine (SQLite WAL)**: All agents, policies, transactions, audit trails, idempotency records, and emergency state are persisted in **SQLite** via `better-sqlite3` located at `server/nexus-wallet.db` with Write-Ahead Logging (`WAL`) mode enabled. *(Note: Early design prototypes referenced JSON files; the production enclave is strictly powered by SQLite WAL).*

---

## 2. Configuration & Environment Variables

All sensitive backend configuration is managed via `server/.env` (excluded from version control). A safe template is provided in [`server/.env.example`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/server/.env.example).

| Variable Name | Required | Default / Example | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `3001` | Backend enclave listening port. |
| `NODE_ENV` | Optional | `development` | Runtime mode (`development` or `production`). |
| `CHAIN_ID` | **Required** | `84532` | Target EVM Chain ID (Base Sepolia enforced). |
| `NETWORK_NAME` | Optional | `Base Sepolia` | Active network display name. |
| `RPC_URL` | **Required** | `https://sepolia.base.org` | Primary JSON-RPC endpoint. |
| `BLOCK_EXPLORER_URL`| Optional | `https://sepolia.basescan.org` | Block explorer URL. |
| `TESTNET_PRIVATE_KEY`| **Required** | `0x4c0883a6...` | Dedicated low-value testnet signer private key (**never mainnet**). |
| `AI_PROVIDER` | Optional | `deterministic` | Intent planner: `deterministic` (default) or `llm`. |
| `JWT_SECRET` | **Required** | *(32+ hex chars)* | HMAC-SHA256 secret for signing operator JWTs (min 16 chars). |
| `JWT_EXPIRES_IN` | Optional | `2h` | Access token lifespan (e.g. `2h`, `1d`). |
| `OPERATOR_EMAIL` | **Required** | `operator@nexus.ai` | Vault operator login email. |
| `OPERATOR_PASSWORD` | **Required** | *(Configured in `server/.env`)* | Vault operator authentication password. |

> [!IMPORTANT]
> `server/.env` is excluded from Git via `.gitignore`. Never reveal private keys, JWT secrets, or production passwords in source code, README, screenshots, Git commits, or presentations.

---

## 3. Installation & Quickstart

### Prerequisites
- Node.js v18+ (tested on Node.js v24.12.0)
- npm v10+

### Step 1: Install Dependencies
```bash
# In the repository root (installs frontend packages):
npm install

# In the server directory (installs enclave packages):
cd server
npm install
cd ..
```

### Step 2: Configure Environment
```bash
cd server
cp .env.example .env
# Edit server/.env with your secrets or use the default testnet credentials
cd ..
```

### Step 3: Start Services
```bash
# Terminal 1: Start Backend Enclave (http://localhost:3001)
cd server
npm run dev

# Terminal 2: Start Frontend Application (http://localhost:4173)
npm run dev
```

---

## 4. Testing & Verification Suites

```bash
# Run comprehensive backend test suite (39 tests: E2E policies + security hardening)
cd server
npm test

# Run SQLite WAL persistence & hash integrity audit
npx tsx test/audit_verification.ts
cd ..

# Run end-to-end acceptance integration suite against running servers
node scripts/verify_acceptance_checklist.mjs

# Run production builds
cd server && npm run build && cd ..
npm run build
```

---

## 5. Security Controls & Guarantees

1. **Zero Client-Side Secrets**: Scanned production bundle (`dist/assets/`) confirms 0 private keys, 0 JWT secrets, and 0 operator API keys.
2. **Deterministic Pre-Flight Interception**: Transactions failing spending limits, velocity limits, or recipient allowlists are rejected **before cryptographic signing**.
3. **No Fabricated Hashes**: Unsigned or rejected transactions never output synthetic `0x` hashes; real hashes are only emitted once on-chain receipts are confirmed.
4. **Idempotency Conflict Guard**: Duplicate requests with identical payloads return cached results; reusing an idempotency key with modified parameters returns **HTTP 409 Conflict**.
5. **Global Circuit Breaker**: Engaging the emergency stop immediately locks out all execution endpoints (HTTP 403) and persists across process restarts.

---

## 6. Known Limitations & Precise Blockchain Scope
 
1. **Precise Blockchain Testing Scope**: The testnet signer wallet currently holds `0 ETH` on Base Sepolia. The platform has verified read-only blockchain RPC connectivity, contract-free native account status, and pre-flight transaction controls—**not a completed on-chain broadcast transfer receipt**. Attempting an execution correctly halts closed with an insufficient balance violation before cryptographic signing.
2. **AI Provider Mode**: Set to `deterministic` by default for zero-latency, predictable hackathon demonstrations. An external LLM can be connected by setting `AI_PROVIDER=llm` and providing `AI_API_KEY`.
3. **Development Dependencies**: Minor npm audit warnings in dev tooling (`esbuild`, `tailwindcss@3.4`) are retained intentionally to preserve frontend layout stability.

---

## 7. 5-Minute Reproducible Demo Script

### Demo Operator Authentication
- **Email**: `operator@nexus.ai`
- **Password**: Enter the `OPERATOR_PASSWORD` value configured in your local `server/.env`.

### Demo Steps:
1. **0:00 - 1:00 | Login & Dashboard**
   - Navigate to `http://localhost:4173/login`.
   - Log in as Chief Treasury Operator.
   - Show live Base Sepolia network connection, wallet address `0x2836...f657`, and enclave status on the Dashboard.
2. **1:00 - 2:00 | AI Agents & Policies**
   - Navigate to **Agents** and **Policies**.
   - Show Autonomous Treasury Bot parameters: 0.01 ETH single-tx limit, 0.05 ETH daily budget, and recipient allowlists.
3. **2:00 - 3:00 | Security Demonstration (Policy Rejections)**
   - On **Agents**, select the Treasury Bot and run task: `Send 0.5 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.
   - **Show result**: Pre-flight rejection before signing (exceeds 0.01 ETH cap).
   - Run task to an unapproved address (`0x999999cf1046e68e36e1aA2E0E07105eDDD1f08E`).
   - **Show result**: Immediate allowlist violation rejection.
4. **3:00 - 4:00 | Idempotency & Emergency Stop**
   - Trigger the **Global Emergency Killswitch** on the Security page.
   - Attempt an agent transfer: instantly rejected (HTTP 403).
   - Demonstrate that unauthorized attempts to resume are blocked, then restore operations.
5. **4:00 - 5:00 | Transactions & Audit Trail**
   - Navigate to **Transactions** and **Monitoring**.
   - Show honest status logging: rejected jobs display clear policy violations with zero synthetic hashes; confirmed jobs show verified receipts.

---

## 8. Presentation Screenshots

High-resolution presentation screenshots are available in [`docs/screenshots/`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/):
- [`01_dashboard.png`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/01_dashboard.png) — Live Base Sepolia Dashboard & Telemetry
- [`02_policies.png`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/02_policies.png) — Active Spending Limits & Velocity Rules
- [`03_transactions.png`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/03_transactions.png) — Honest Transaction Ledger
- [`04_monitoring.png`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/04_monitoring.png) — Real-Time Node Telemetry & Persistent Audit Logs
- [`05_emergency_stop.png`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/docs/screenshots/05_emergency_stop.png) — Active Global Circuit Breaker Lockout
