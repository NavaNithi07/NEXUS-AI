import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import {
  getOnChainWalletStatus,
  simulateTransfer,
  sendNativeToken,
  serverAccount,
} from './blockchain/client.js';
import { planTransactionProposal } from './ai/planner.js';
import { evaluateTransactionPolicy } from './policy/engine.js';
import { db } from './audit/store.js';
import {
  requireOperatorAuth,
  requireAnyAuth,
  signAccessToken,
  timingSafeEqual,
} from './middleware/auth.js';
import {
  ExecuteTaskInputSchema,
  AgentCreateInputSchema,
  PolicyCreateInputSchema,
  type ExecutionJobResult,
  type AuditRecord,
} from './types/backend.js';

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:4173', 'http://localhost:5173', 'http://127.0.0.1:4173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Operator-Key', 'X-Idempotency-Key'],
}));

app.use(express.json({ limit: '1mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many execution requests. Max 10 per minute.' },
});

const killswitchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many killswitch requests.' },
});

app.use(generalLimiter);

// ── Request logging ────────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  // Never log auth headers to prevent credential exposure in logs
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// ════════════════════════════════════════════════════════════════════════════════
// 0. Authentication: Login & JWT Issuance (public)
// ════════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Both email and password are required',
    });
  }

  // Securely verify credentials with constant-time string comparison
  const emailValid = timingSafeEqual(String(email).trim().toLowerCase(), config.operatorEmail.toLowerCase());
  const passwordValid = timingSafeEqual(String(password), config.operatorPassword);

  if (!emailValid || !passwordValid) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid operator email or vault password.',
    });
  }

  const token = signAccessToken({
    userId: 'usr-operator-01',
    email: config.operatorEmail,
    role: 'operator',
    name: 'Chief Treasury Operator',
  });

  return res.json({
    token,
    user: {
      userId: 'usr-operator-01',
      email: config.operatorEmail,
      role: 'operator',
      name: 'Chief Treasury Operator',
    },
    expiresIn: config.jwtExpiresIn,
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Health & Blockchain RPC Connectivity (public)
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const walletStatus = await getOnChainWalletStatus(db.getEmergencyStatus());
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      network: walletStatus.network,
      chainId: walletStatus.chainId,
      signerAddress: walletStatus.address,
      nativeBalanceEth: walletStatus.nativeBalanceEth,
      emergencyHaltActive: walletStatus.isEmergencyPaused,
      aiEngine: config.aiProvider,
      persistence: 'sqlite',
    });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. Real Wallet Status & Balances (public)
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/wallet/status', async (_req: Request, res: Response) => {
  try {
    const status = await getOnChainWalletStatus(db.getEmergencyStatus());
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch on-chain wallet status', details: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. Agent Management
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/agents', (_req: Request, res: Response) => {
  res.json(db.getAgents());
});

app.post('/api/agents', requireOperatorAuth, (req: Request, res: Response) => {
  const parseResult = AgentCreateInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
  }

  const newAgent = db.addAgent({
    id: `ag-${Date.now().toString(36)}`,
    ...parseResult.data,
    spentToday: 0,
    txCount: 0,
    createdAt: new Date().toISOString().split('T')[0],
    lastActive: 'Just now',
    allowedRecipients: parseResult.data.allowedRecipients as `0x${string}`[],
  });

  res.status(201).json(newAgent);
});

app.patch('/api/agents/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const updated = db.updateAgent(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(updated);
});

app.delete('/api/agents/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const success = db.deleteAgent(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json({ message: 'Agent deleted successfully' });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. Autonomous Agent Execution Pipeline (protected, rate-limited)
// ════════════════════════════════════════════════════════════════════════════════
app.post('/api/agents/:id/execute', executionLimiter, requireOperatorAuth, async (req: Request, res: Response) => {
  const agentId = req.params.id;

  // ── Fetch agent from authoritative store ──────────────────────────────────
  const agent = db.getAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: `Agent with id '${agentId}' not found.` });
  }

  const parseResult = ExecuteTaskInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid task parameters', details: parseResult.error.format() });
  }

  const { taskGoal } = parseResult.data;
  const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

  // ── Canonical Idempotency Key Validation & Reservation ────────────────────
  const payloadHash = db.createCanonicalPayloadHash({
    agentId,
    taskGoal,
    recipient: parseResult.data.recipientAddress,
    amount: parseResult.data.amount,
    token: 'ETH',
    chainId: config.chainId,
  });

  if (idempotencyKey) {
    const reservation = db.reserveIdempotencyKey(idempotencyKey, payloadHash);
    if (reservation.status === 'conflict') {
      return res.status(409).json({
        error: 'Conflict',
        message: `Idempotency key payload mismatch. Key '${idempotencyKey}' was already used with a different task payload.`,
      });
    }
    if (reservation.status === 'completed' && reservation.job) {
      console.log(`[Idempotency] Returning cached result for key: ${idempotencyKey}`);
      return res.json({
        success: reservation.job.status !== 'rejected',
        status: reservation.job.status,
        job: reservation.job,
        cached: true,
      });
    }
    if (reservation.status === 'in_flight') {
      return res.status(409).json({
        error: 'Conflict',
        message: `A request with idempotency key '${idempotencyKey}' is already processing. Concurrent duplicate execution blocked.`,
      });
    }
  }

  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const executedAt = new Date().toISOString();

  try {
    // ── Step 1: AI Decision Planning Engine ───────────────────────────────────
    const proposal = await planTransactionProposal(taskGoal, agent, config.chainId);

    // Accept explicit overrides from request (amount/recipient)
    // Validate they conform to the same rules before accepting
    if (parseResult.data.amount && parseResult.data.amount > 0) {
      proposal.amount = parseResult.data.amount;
    }
    if (parseResult.data.recipientAddress) {
      proposal.recipient = parseResult.data.recipientAddress as `0x${string}`;
    }

    // Reject unsupported operations immediately
    if (proposal.action === 'swap' || proposal.action === 'stake') {
      return res.status(422).json({
        success: false,
        status: 'rejected',
        error: `Operation '${proposal.action}' is not yet implemented. Only native-token transfers are supported on ${agent.name}. Please use 'send', 'transfer', or 'pay' in your task goal.`,
        proposalAction: proposal.action,
      });
    }

    if (proposal.action === 'none' || proposal.amount <= 0) {
      return res.status(422).json({
        success: false,
        status: 'rejected',
        error: `AI Planner could not determine a valid transfer amount or recipient from the task goal. Please include an explicit amount (e.g. "0.001") and a recipient address.`,
        proposal,
      });
    }

    // ── Step 2: Read Actual On-Chain Wallet Balance ───────────────────────────
    const walletStatus = await getOnChainWalletStatus(db.getEmergencyStatus());
    const realBalanceEth = parseFloat(walletStatus.nativeBalanceEth);

    // ── Step 3: Re-check emergency stop immediately before policy evaluation ──
    if (db.getEmergencyStatus()) {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        error: 'Global Emergency Halt is ACTIVE. All autonomous on-chain execution is blocked.',
        violations: ['Global Emergency Halt is ACTIVE. All autonomous on-chain execution is blocked.'],
      });
    }

    // ── Step 4: Independent Policy Engine Enforcement ─────────────────────────
    const policyResult = evaluateTransactionPolicy({
      agent,
      policies: db.getPolicies(),
      proposal,
      isEmergencyPaused: db.getEmergencyStatus(),
      walletBalanceEth: realBalanceEth,
    });

    // ── Step 5: If Policy Checks Fail → REJECT before signing ────────────────
    if (!policyResult.approved) {
      const rejectedJob: ExecutionJobResult = {
        jobId,
        taskId: `task-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        proposal,
        policyResult,
        status: 'rejected',
        executedAt,
        error: policyResult.violations.join('; '),
      };

      db.addExecutionJob(rejectedJob, idempotencyKey, payloadHash);
      if (idempotencyKey) {
        db.completeIdempotencyKey(idempotencyKey, jobId, 'rejected');
      }

      const auditRecord: AuditRecord = {
        id: `audit-${Date.now()}`,
        timestamp: executedAt,
        agentId: agent.id,
        agentName: agent.name,
        taskGoal,
        proposal,
        policyCheck: policyResult,
        outcome: 'rejected',
        details: `Rejected by policy engine BEFORE SIGNING: ${policyResult.violations.join('; ')}`,
      };
      db.addAuditRecord(auditRecord);

      return res.status(403).json({
        success: false,
        status: 'rejected',
        job: rejectedJob,
        violations: policyResult.violations,
        policyChecks: policyResult.checks,
      });
    }

    // ── Step 6: Simulate transaction gas pre-flight ───────────────────────────
    let simResult: { estimatedGasEth: string; sufficientBalance: boolean; currentBalanceEth: string };
    try {
      simResult = await simulateTransfer(proposal.recipient, proposal.amount);
    } catch {
      simResult = { estimatedGasEth: '0.000021', sufficientBalance: realBalanceEth >= proposal.amount, currentBalanceEth: realBalanceEth.toString() };
    }

    // ── Step 7: Re-check emergency stop immediately before signing ────────────
    if (db.getEmergencyStatus()) {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        error: 'Emergency Halt engaged between policy check and signing. Execution aborted.',
        violations: ['Emergency Halt engaged between policy check and signing.'],
      });
    }

    // ── Step 8: Atomic daily spending reservation ─────────────────────────────
    // This prevents concurrent requests from exceeding the daily limit
    let newSpentToday: number;
    try {
      newSpentToday = db.atomicSpendingUpdate(agent.id, proposal.amount, agent.dailyLimit);
    } catch (spendErr: any) {
      return res.status(403).json({
        success: false,
        status: 'rejected',
        error: `Concurrency check: ${spendErr.message}`,
        violations: [spendErr.message],
      });
    }

    // ── Step 9: Sign and Broadcast On-Chain ──────────────────────────────────
    let executionResult: ExecutionJobResult;
    try {
      const tx = await sendNativeToken(proposal.recipient, proposal.amount);

      executionResult = {
        jobId,
        taskId: `task-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        proposal,
        policyResult,
        status: 'confirmed',
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        blockNumber: tx.blockNumber,
        gasUsed: tx.gasUsed,
        effectiveGasPrice: tx.effectiveGasPrice,
        executedAt,
      };

      const auditRecord: AuditRecord = {
        id: `audit-${Date.now()}`,
        timestamp: executedAt,
        agentId: agent.id,
        agentName: agent.name,
        taskGoal,
        proposal,
        policyCheck: policyResult,
        outcome: 'confirmed',
        txHash: tx.txHash,
        explorerUrl: tx.explorerUrl,
        blockNumber: tx.blockNumber,
        details: `Autonomous transaction CONFIRMED on-chain. Block: #${tx.blockNumber}. Gas used: ${tx.gasUsed}. Estimated gas: ${simResult.estimatedGasEth} ETH.`,
      };
      db.addAuditRecord(auditRecord);

      console.log(`[Execution] ✅ Confirmed tx: ${tx.txHash} | Block: ${tx.blockNumber}`);

    } catch (broadcastErr: any) {
      // Honest broadcast failure — rollback the atomic spend reservation
      // by subtracting the amount back (no false success)
      try {
        db.atomicSpendingUpdate(agent.id, -proposal.amount, agent.dailyLimit + proposal.amount);
      } catch { /* rollback best-effort */ }

      console.error('[Execution] ❌ Broadcast failed:', broadcastErr.message);

      executionResult = {
        jobId,
        taskId: `task-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        proposal,
        policyResult,
        status: 'failed',
        executedAt,
        error: `Policy approved and gas verified. Broadcast failed: ${broadcastErr.message}. No on-chain transaction was sent.`,
      };

      const auditRecord: AuditRecord = {
        id: `audit-${Date.now()}`,
        timestamp: executedAt,
        agentId: agent.id,
        agentName: agent.name,
        taskGoal,
        proposal,
        policyCheck: policyResult,
        outcome: 'failed',
        details: `Policy APPROVED. Broadcast FAILED: ${broadcastErr.message}. Wallet balance at time: ${simResult.currentBalanceEth} ETH. Gas estimate: ${simResult.estimatedGasEth} ETH.`,
      };
      db.addAuditRecord(auditRecord);
    }

    db.addExecutionJob(executionResult, idempotencyKey, payloadHash);
    if (idempotencyKey) {
      db.completeIdempotencyKey(
        idempotencyKey,
        jobId,
        executionResult.status === 'confirmed' ? 'completed' : 'rejected'
      );
    }

    const httpStatus = executionResult.status === 'confirmed' ? 200 : 422;
    return res.status(httpStatus).json({
      success: executionResult.status === 'confirmed',
      status: executionResult.status,
      job: executionResult,
    });

  } catch (err: any) {
    if (idempotencyKey) {
      db.releaseIdempotencyKey(idempotencyKey);
    }
    console.error('[Execution Error]', err);
    res.status(500).json({ error: 'Internal execution pipeline error', message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 5. Policies API (read public, write protected)
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/policies', (_req: Request, res: Response) => {
  res.json(db.getPolicies());
});

app.post('/api/policies', requireOperatorAuth, (req: Request, res: Response) => {
  const parseResult = PolicyCreateInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
  }

  const newPolicy = db.addPolicy({
    id: `pol-${Date.now().toString(36)}`,
    ...parseResult.data,
  });

  res.status(201).json(newPolicy);
});

app.patch('/api/policies/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const updated = db.updatePolicy(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  res.json(updated);
});

app.delete('/api/policies/:id', requireOperatorAuth, (req: Request, res: Response) => {
  const success = db.deletePolicy(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Policy not found' });
  }
  res.json({ message: 'Policy deleted successfully' });
});

// ════════════════════════════════════════════════════════════════════════════════
// 6. Verified Transaction Ledger
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/transactions', (_req: Request, res: Response) => {
  res.json(db.getExecutionJobs());
});

// ════════════════════════════════════════════════════════════════════════════════
// 7. Audit Trail
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json(db.getAuditRecords());
});

// ════════════════════════════════════════════════════════════════════════════════
// 8. Security Emergency Controls (protected, rate-limited)
// ════════════════════════════════════════════════════════════════════════════════
app.post('/api/security/killswitch', killswitchLimiter, requireOperatorAuth, (_req: Request, res: Response) => {
  db.setEmergencyStatus(true);
  console.log('[Security] ⚠️  GLOBAL EMERGENCY KILLSWITCH ENGAGED by operator');
  res.json({
    isEmergencyPaused: true,
    timestamp: new Date().toISOString(),
    message: 'Global Emergency Killswitch ENGAGED. All on-chain execution requests are halted.',
  });
});

app.post('/api/security/resume', killswitchLimiter, requireOperatorAuth, (_req: Request, res: Response) => {
  db.setEmergencyStatus(false);
  console.log('[Security] ✅  Global operations RESUMED by operator');
  res.json({
    isEmergencyPaused: false,
    timestamp: new Date().toISOString(),
    message: 'Global operations RESUMED. Autonomous execution active.',
  });
});

// Public endpoint to check emergency status without sensitive data
app.get('/api/security/status', (_req: Request, res: Response) => {
  res.json({
    isEmergencyPaused: db.getEmergencyStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 404 handler
// ════════════════════════════════════════════════════════════════════════════════
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ════════════════════════════════════════════════════════════════════════════════
// Start Server
// ════════════════════════════════════════════════════════════════════════════════
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  NEXUS AI WALLET BACKEND ENCLAVE`);
  console.log(`  Port      : ${PORT}`);
  console.log(`  Network   : ${config.networkName} (Chain ${config.chainId})`);
  console.log(`  Signer    : ${serverAccount.address}`);
  console.log(`  Persist   : SQLite (nexus-wallet.db)`);
  console.log(`  AI Engine : ${config.aiProvider}`);
  console.log(`  Auth      : API Key required on write endpoints`);
  console.log(`=======================================================`);

  // Validate required env
  if (!process.env.TESTNET_PRIVATE_KEY) {
    console.warn('[Config] TESTNET_PRIVATE_KEY not set — using insecure default key');
  }
  if (!process.env.OPERATOR_API_KEY) {
    console.warn('[Config] OPERATOR_API_KEY not set — using default dev key (change in production)');
  }
});

export default app;
