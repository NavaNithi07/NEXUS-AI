# NEXUS AI WALLET — 5-MINUTE COMPETITION DEMO VIDEO SCRIPT
**Competition Track**: Shenzhen International FinTechathon 2026 — Topic F  
**Target Duration**: 4 Minutes 45 Seconds  
**Format**: Screen recording with live audio voiceover  

---

### Segment 1: Platform Overview & Zero-Trust Authentication (0:00 - 0:45)
- **Visual**: Browser at `http://localhost:4173/login`. Terminal showing backend running on port 3001.
- **Action**:
  - Show login screen with dark navy/cyan institutional theme.
  - Enter operator credentials (`operator@nexus.ai`).
  - Open browser DevTools Network tab: highlight HTTP 200 response returning a JWT Bearer token.
  - Inspect LocalStorage / SessionStorage: point out that **zero private keys or seed phrases exist on the client**.
- **Voiceover**:
  > *"Welcome to NEXUS AI, an institutional-grade autonomous on-chain wallet platform designed for Topic F of the 2026 FinTechathon. Unlike typical hackathon prototypes that expose private keys in browser memory or rely on client-side checks, NEXUS operates as an air-gapped enclave. All cryptographic keys remain strictly on the backend, and operators authenticate via short-lived, rotatable JWT Bearer tokens."*

---

### Segment 2: Dashboard & Real Base Sepolia Telemetry (0:45 - 1:30)
- **Visual**: Dashboard view at `http://localhost:4173/`.
- **Action**:
  - Point to the live Base Sepolia network badge (`Chain ID: 84532`).
  - Show the signer address `0x2836...f657`, live account nonce, and current native balance.
  - Highlight the four autonomous agents: Arbitrage Bot, DEX Liquidity, Yield Optimizer, and Treasury Manager.
- **Voiceover**:
  > *"On the dashboard, we see live blockchain telemetry queried directly from Base Sepolia via our Viem client. Notice the system is operating in a live testnet environment. The enclave monitors real-time nonces, gas fee estimations with a +20% safety buffer, and active agent allocations."*

---

### Segment 3: Autonomous Agent Intent Planning & Policy Rejection (1:30 - 2:45)
- **Visual**: Agents page at `http://localhost:4173/agents`.
- **Action**:
  - Select Autonomous Treasury Bot. Review policy parameters: 0.01 ETH single-tx limit, 0.05 ETH daily budget.
  - Enter task goal: *"Send 0.05 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"*.
  - Click "Execute Task Proposal".
  - Show immediate pre-flight policy rejection modal:
    `"Transaction amount (0.05 ETH) exceeds maximum single-transaction limit of 0.01 ETH."`
  - Now enter task to an unapproved address: *"Send 0.005 ETH to 0x999999cf1046e68e36e1aA2E0E07105eDDD1f08E"*.
  - Show immediate allowlist rejection before signing.
- **Voiceover**:
  > *"Here we demonstrate our core security principle: AI is untrusted. When an agent proposes a transfer exceeding its single-transaction cap, the server-side Policy Engine intercepts and rejects the request BEFORE any cryptographic signing occurs. Similarly, transfers to non-allowlisted recipients are blocked with zero exceptions."*

---

### Segment 4: Global Emergency Circuit Breaker (2:45 - 3:30)
- **Visual**: Security page at `http://localhost:4173/security`.
- **Action**:
  - Click "Trigger Emergency Halt". Confirm with master operator password.
  - The UI updates instantly with a high-visibility red Emergency Lockout banner.
  - Switch back to the Agents page and attempt any transaction: immediately halted with HTTP 403 Forbidden.
  - Restart the backend terminal to prove persistence: emergency halt remains active across restarts!
  - Return to Security page and disengage the killswitch.
- **Voiceover**:
  > *"In production fintech systems, circuit breakers must be absolute. Engaging the Global Emergency Stop immediately locks out all execution endpoints across the entire backend. Even if the server process crashes and reboots, the halted state persists durably in SQLite WAL and Neon PostgreSQL."*

---

### Segment 5: Tamper-Evident Audit Hash Chain & Ledger Honesty (3:30 - 4:15)
- **Visual**: Monitoring view at `http://localhost:4173/monitoring`.
- **Action**:
  - Click "Verify Cryptographic Audit Chain".
  - Show live result: 100% of blocks verified from Genesis hash `0000...0000`.
  - Navigate to Transactions view: show that rejected transactions have **zero synthetic 0x hashes**, while broadcasted transactions include verified BaseScan explorer links.
- **Voiceover**:
  > *"Every action in NEXUS AI is sealed in an append-only cryptographic hash chain. Any post-hoc database tampering immediately breaks the chain digest. Furthermore, NEXUS maintains complete ledger honesty: rejected proposals never fabricate synthetic 0x hashes."*

---

### Segment 6: Conclusion & Verification Summary (4:15 - 4:45)
- **Visual**: Terminal showing `npm test` passing 89/89 automated tests cleanly.
- **Voiceover**:
  > *"With 89 automated tests passing, zero client-side secret exposure, atomic spending serialization, and complete Base Sepolia testnet integration, NEXUS AI delivers the robust security architecture required for institutional autonomous on-chain finance. Thank you."*
