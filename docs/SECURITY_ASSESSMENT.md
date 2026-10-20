# NEXUS AI WALLET — SECURITY SELF-ASSESSMENT REPORT
**Competition**: Shenzhen International FinTechathon 2026 — Topic F  
**Category Evaluation Focus**: Security & Compliance (Weight: 30%)  
**Assessment Date**: October 20, 2026  
**Auditor**: Lead Application & Blockchain Security Engineer  
**Classification**: Public Submission Evidence  

---

## 1. Executive Security Summary

The NEXUS AI Autonomous On-Chain Wallet was designed under a **Zero-Trust Client, Defense-in-Depth Enclave** paradigm. Because autonomous agent wallets possess automated execution capabilities, client-side validation is treated as cosmetic; all critical policy constraints, authentication checks, idempotency tracking, and transaction signing are performed exclusively on the backend server.

### Automated Security Test Suite Results:
- **Bank-Grade Security Suite (`bank_grade_security.test.ts`)**: 24/24 PASSED (100%)
- **Priority Verification Suite (`priority_verification.test.ts`)**: 21/21 PASSED (100%)
- **Security Hardening Suite (`security_hardening.test.ts`)**: 16/16 PASSED (100%)
- **Audit Verification Runner (`audit_verification.ts`)**: 7/7 PASSED (100%)
- **Static Code Audit (`oxlint`, zero client secret scans)**: 0 Secrets Found in Production Bundle

---

## 2. Threat Model & Mitigation Matrix

| Threat ID | Threat Vector | Potential Impact | Implemented Mitigation & Evidence | Status |
| :---: | :--- | :--- | :--- | :---: |
| **TH-01** | **Prompt Injection / Advisory AI Hijack** | Malicious prompt instructs AI to drain funds to an attacker address. | **Air-gapped advisory pipeline**. AI proposals cannot override backend policy limits. Non-allowlisted recipients rejected pre-signing. | **MITIGATED** |
| **TH-02** | **Parameter Tampering Between Simulation & Execution** | Attacker simulates safe 0.001 ETH transfer, then submits 10 ETH to signing endpoint. | **Cryptographic Binding Hash**. Simulation generates SHA-256 fingerprint binding chain, to, amount, and calldata. Tampering returns HTTP 409 Conflict. | **MITIGATED** |
| **TH-03** | **Concurrent Race Conditions (Double Spending)** | Multiple simultaneous requests attempt to bypass daily spending limits. | **Atomic Row-Level Locking**. Neon PostgreSQL / SQLite WAL serializes spend checks. 10 parallel 0.01 ETH requests under a 0.05 limit: exactly 5 succeed, 5 reject. | **MITIGATED** |
| **TH-04** | **Network Replay / Duplicate Broadcasts** | Network retries cause duplicate payments to be executed twice. | **Canonical Idempotency Engine**. Keys are fingerprint-bound. Retries return cached execution receipts without re-signing. | **MITIGATED** |
| **TH-05** | **Private Key Exposure in Client / Browser** | Inspecting local storage or bundle reveals wallet private key. | **Zero Client-Side Keys**. Signing keys reside strictly in `server/.env`. Production bundle scans verify 0 private keys or JWT secrets in `dist/assets/`. | **MITIGATED** |
| **TH-06** | **Mainnet Execution with Testnet Signer** | Configuration error attempts to use testnet key on Ethereum Mainnet. | **Fail-Closed Chain Guards**. Client and Key Management Provider strictly reject Chain ID 1. Execution halts before signing. | **MITIGATED** |
| **TH-07** | **Audit Trail Tampering** | Attacker modifies historical database records to conceal unauthorized transfers. | **Append-Only SHA-256 Hash Chain**. Every record links cryptographically to the prior record's hash. Post-hoc DB edits break verification. | **MITIGATED** |
| **TH-08** | **Token Theft / Session Hijacking** | Refresh token intercepted from client storage. | **Token Rotation & Replay Invalidation**. Reusing an already-rotated refresh token immediately revokes all active sessions for that user. | **MITIGATED** |
| **TH-09** | **Brute-Force Authentication Attack** | Automated script attempts password guessing on operator login. | **Account Lockout & Rate Limiting**. 5 failed login attempts trigger a 15-minute lockout. `express-rate-limit` throttles API access. | **MITIGATED** |
| **TH-10** | **Rogue Autonomous Execution During Anomaly** | Unexpected agent behavior requires immediate halt. | **Global Emergency Killswitch**. Instantly halts all signing and execution at the backend (HTTP 403). Persists across server restarts. | **MITIGATED** |

---

## 3. Detailed Control Verification

### 3.1 Authentication & Authorization
- **Password Storage**: Scrypt with per-user cryptographic salt (`N=16384, r=8, p=1`).
- **Session Tokens**: Short-lived JWT access tokens (15 minutes default) signed with HMAC-SHA256 (`min 32 bytes`).
- **Refresh Flow**: Refresh tokens stored as cryptographic hashes; rotated upon every refresh. Replay of an old token triggers automatic session invalidation.

### 3.2 Pre-Execution Policy Enforcement
The Policy Engine strictly enforces:
```
IF (Agent.Status != 'active') -> HALT (403)
IF (EmergencyStop == TRUE) -> HALT (403)
IF (ChainId != 84532 && ChainId != 421614) -> HALT (400)
IF (Proposal.Amount > Agent.MaxTxAmount) -> HALT (403)
IF (Agent.SpentToday + Proposal.Amount > Agent.DailyLimit) -> HALT (403)
IF (Proposal.Recipient NOT IN Agent.AllowedRecipients) -> HALT (403)
IF (WalletBalance < Proposal.Amount + EstimatedGas) -> HALT (403)
```
**All evaluations occur before `walletClient.sendTransaction` is ever called.**

### 3.3 Signing Safety & Fail-Closed Boundaries
- Testnet signer is hard-coded to reject Mainnet (`chainId === 1`).
- Cloud KMS signer safely fails closed if `KEY_ARN` or cloud credentials are missing.
- When receipt confirmation times out, the backend retains the broadcasted `txHash` in state `submitted_pending_reconciliation`—it **never marks a timeout as confirmed** and **never fabricates a synthetic hash**.

---

## 4. Known Risks & Production Roadmap

1. **Testnet Software Signer**: Currently, testnet execution utilizes a local private key configured in `server/.env`. For institutional mainnet deployments with real capital, this must be replaced with a **Hardware Security Module (FIPS 140-2 Level 3 HSM)** or **AWS/GCP Cloud KMS** multi-party computation enclave.
2. **Testnet Wallet Balance**: The demonstration wallet holds `0 ETH` on Base Sepolia. Read-only RPC, fee estimation, and pre-flight policy rejection operate live, but actual blockchain broadcasting requires faucet test funds.
