# Nexus AI Wallet — Autonomous On-Chain AI Wallet Platform

A production-ready autonomous on-chain AI agent wallet platform built with React, Vite, TypeScript, Express, Viem, and SQLite. Nexus AI enables autonomous agents to plan, execute, and monitor on-chain transactions governed strictly by deterministic security policies, velocity caps, allowlists, and global emergency circuit breakers.

---

## Architecture Overview

- **Frontend (`/src`)**: High-performance React 18 SPA with Tailwind CSS, Framer Motion, and Lucide icons. Communicates exclusively with the backend enclave via typed REST APIs and JWT Bearer authorization.
- **Backend Enclave (`/server`)**: Node.js/Express service responsible for:
  - AI transaction intent planning (deterministic rules engine or LLM).
  - Multi-tier policy validation engine (spending caps, allowlists, daily velocity limits).
  - Dynamic fee estimation with safety buffers and fee caps on Base Sepolia (`chainId: 84532`).
  - Canonical payload hashing and strictly idempotent execution.
  - SQLite WAL persistent transaction ledger, audit trail, and emergency state machine.

---

## Configuration & Environment Variables

All sensitive backend configuration is managed via environment variables stored in `server/.env` (which is excluded from Git via `.gitignore`). An example template is provided in [`server/.env.example`](file:///c:/Users/vignesh/Downloads/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/AUTONOMOUS%20ON-CHAIN%20AI%20WALLET%20PLATFORM/server/.env.example).

### Required & Documented Variables

| Variable Name | Required | Default / Example | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Optional | `3001` | Port on which the Express backend enclave listens. |
| `NODE_ENV` | Optional | `development` | Environment mode (`development` or `production`). |
| `CHAIN_ID` | Optional | `84532` | Target EVM Chain ID. Enforces Base Sepolia testnet execution. |
| `NETWORK_NAME` | Optional | `Base Sepolia` | Display name of the active network. |
| `RPC_URL` | Optional | `https://sepolia.base.org` | Primary JSON-RPC endpoint for Base Sepolia. |
| `BLOCK_EXPLORER_URL` | Optional | `https://sepolia.basescan.org` | Block explorer URL for transaction verification links. |
| `FALLBACK_CHAIN_ID` | Optional | `421614` | Secondary EVM Chain ID for fallback connectivity (Arbitrum Sepolia). |
| `FALLBACK_NETWORK_NAME`| Optional | `Arbitrum Sepolia` | Display name of the fallback network. |
| `FALLBACK_RPC_URL` | Optional | `https://sepolia-rollup.arbitrum.io/rpc` | Fallback JSON-RPC endpoint. |
| `FALLBACK_BLOCK_EXPLORER_URL` | Optional | `https://sepolia.arbiscan.io` | Fallback block explorer URL. |
| `TESTNET_PRIVATE_KEY` | **Required** | `0x4c0883a6...` | Dedicated low-value testnet private key. **NEVER use mainnet keys or keys with real asset value.** |
| `AI_PROVIDER` | Optional | `deterministic` | Intent extraction provider: `deterministic` (default rule engine) or `llm`. |
| `AI_API_KEY` | Optional | *(empty)* | Optional API key when using an external LLM provider. |
| `JWT_SECRET` | **Required** | *(32+ hex characters)* | Cryptographic HMAC-SHA256 secret for signing and verifying operator JWTs (min 16 chars required). |
| `JWT_EXPIRES_IN` | Optional | `2h` | Expiration duration for operator access tokens (e.g., `2h`, `1d`). |
| `OPERATOR_EMAIL` | **Required** | `operator@nexus.ai` | Vault operator login email address. |
| `OPERATOR_PASSWORD` | **Required** | `nexus2026!secure` | Vault operator authentication password. |
| `OPERATOR_API_KEY` | Optional | `nexus-dev-api-key...` | Secondary API key for automated test runner scripts. |

### Security Guarantees & Secret Isolation

1. **`.env` Exclusion**: `.env` and `*.db` files are strictly excluded from source control in both root and server `.gitignore`.
2. **Frontend Enclave Isolation**: Neither the private key (`TESTNET_PRIVATE_KEY`), JWT secret (`JWT_SECRET`), nor operator passwords exist in the client bundle. Only short-lived JWT tokens obtained via `/api/auth/login` are used in the browser.
3. **No Fabricated Hashes**: Unsigned or rejected transactions never output synthetic `0x` hashes; real hashes are only emitted once on-chain receipts are confirmed.

---

## Running the Platform Locally

### 1. Start the Backend Enclave
```bash
cd server
npm install
npm run dev
# Server listens on http://localhost:3001
```

### 2. Start the Frontend Application
```bash
# In the root project directory:
npm install
npm run dev
# Vite runs on http://localhost:4173 with proxy configured for /api -> http://localhost:3001
```

### 3. Running Automated Tests
```bash
cd server
npm test
# Runs unit, integration, and security hardening suites:
# - E2E planning & policy engine checks
# - JWT RBAC authorization
# - Idempotency concurrency & payload mismatch conflict detection (HTTP 409)
# - Emergency stop persistence and restart survival
# - Gas fee buffers & caps
```

---

## Operator Development Credentials (Testnet)

- **Email**: `operator@nexus.ai`
- **Password**: `NexusVault_2026!SecOps_Alpha` (Rotated secure password set in `server/.env`)

> [!IMPORTANT]
> Keep `.env` strictly excluded from Git. Never reveal private keys, JWT secrets, or production passwords during demo presentations or public recordings.
