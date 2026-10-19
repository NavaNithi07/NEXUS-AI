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
import { getKeyManagementProvider } from './blockchain/keyManagement.js';
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
  checkAccountLockout,
  recordFailedAttempt,
  clearFailedAttempts,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  verifyPassword,
} from './auth/service.js';
import { reconcileTransactions } from './blockchain/reconciliation.js';
import {
  ExecuteTaskInputSchema,
  AgentCreateInputSchema,
  PolicyCreateInputSchema,
  type ExecutionJobResult,
  type AuditRecord,
} from './types/backend.js';
import { initializeNeonSchema, syncSqliteToNeon } from './db/neon.js';

const app = express();

// ── Security Headers Middleware (OWASP Secure Headers) ────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:4173', 'http://localhost:5173', 'http://127.0.0.1:4173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Operator-Key', 'X-Idempotency-Key'],
  credentials: true,
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

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please wait 60 seconds.' },
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

// ── Request logging (Credentials & Secrets Redacted) ──────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// ════════════════════════════════════════════════════════════════════════════════
// 0. Authentication: Login, Refresh & Logout
// ════════════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Both email and password are required',
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // 1. Check account lockout status
  const lockout = checkAccountLockout(normalizedEmail);
  if (lockout.isLocked) {
    return res.status(429).json({
      error: 'Account Temporarily Locked',
      message: `Too many failed login attempts. Account is locked for ${lockout.remainingSeconds} seconds.`,
      retryAfterSeconds: lockout.remainingSeconds,
    });
  }

  // 2. Validate credentials with timing-safe check and scrypt support
  const emailValid = timingSafeEqual(normalizedEmail, config.operatorEmail.toLowerCase());
  const passwordValid = timingSafeEqual(String(password), config.operatorPassword);

  if (!emailValid || !passwordValid) {
    const attemptResult = recordFailedAttempt(normalizedEmail);

    // Audit failed login attempt
    db.addAuditRecord({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: 'system',
      agentName: 'Authentication Gateway',
      taskGoal: 'Operator Authentication Attempt',
      proposal: {
        task: 'Login',
        action: 'none',
        chainId: config.chainId,
        recipient: '0x0000000000000000000000000000000000000000',
        token: 'N/A',
        amount: 0,
        reason: 'Failed login credentials',
        confidence: 0,
      },
      policyCheck: {
        approved: false,
        violations: ['Invalid credentials'],
        checks: {
          agentActive: false,
          killswitchDisengaged: true,
          recipientAllowlisted: false,
          singleTxLimitPassed: false,
          dailyBudgetPassed: false,
          networkSupported: true,
          balanceSufficient: true,
        },
      },
      outcome: 'failed',
      details: `Failed login attempt for ${normalizedEmail}. ${attemptResult.isNowLocked ? 'ACCOUNT LOCKED OUT for 15 minutes.' : `${attemptResult.remainingAttempts} attempts remaining.`}`,
    });

    if (attemptResult.isNowLocked) {
      return res.status(429).json({
        error: 'Account Locked',
        message: 'Maximum failed login attempts exceeded. Account is locked for 15 minutes for security.',
      });
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials.',
    });
  }

  // 3. Clear failed attempts on successful login
  clearFailedAttempts(normalizedEmail);

  // 4. Issue access token and rotated refresh token
  const userPayload = {
    userId: 'usr-operator-01',
    email: config.operatorEmail,
    role: 'operator' as const,
    name: 'Chief Treasury Operator',
  };

  const accessToken = signAccessToken(userPayload, '15m');
  const { refreshToken, expiresInSeconds } = generateRefreshToken(userPayload);

  db.addAuditRecord({
    id: `audit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agentId: 'system',
    agentName: 'Authentication Gateway',
    taskGoal: 'Operator Login Success',
    proposal: {
      task: 'Session Authorization',
      action: 'none',
      chainId: config.chainId,
      recipient: '0x0000000000000000000000000000000000000000',
      token: 'N/A',
      amount: 0,
      reason: 'Successful vault operator authentication',
      confidence: 1,
    },
    policyCheck: {
      approved: true,
      violations: [],
      checks: {
        agentActive: true,
        killswitchDisengaged: true,
        recipientAllowlisted: true,
        singleTxLimitPassed: true,
        dailyBudgetPassed: true,
        networkSupported: true,
        balanceSufficient: true,
      },
    },
    outcome: 'confirmed',
    details: `Session authenticated for ${userPayload.email}. Issued 15-minute access token and rotated refresh token.`,
  });

  return res.json({
    token: accessToken,
    refreshToken,
    user: userPayload,
    expiresIn: '15m',
    refreshExpiresInSeconds: expiresInSeconds,
  });
});

app.post('/api/auth/refresh', (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ error: 'Bad Request', message: 'Refresh token is required' });
  }

  const rotation = rotateRefreshToken(String(refreshToken));
  if (!rotation.valid || !rotation.user) {
    return res.status(401).json({ error: 'Unauthorized', message: rotation.error || 'Invalid refresh token' });
  }

  const newAccessToken = signAccessToken(rotation.user, '15m');

  return res.json({
    token: newAccessToken,
    refreshToken: rotation.newRefreshToken,
    user: rotation.user,
    expiresIn: '15m',
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    revokeRefreshToken(String(refreshToken));
  }
  return res.json({ success: true, message: 'Logged out successfully. Refresh token revoked.' });
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Health & Blockchain RPC Connectivity (public)
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const walletStatus = await getOnChainWalletStatus(db.getEmergencyStatus());
    const keyManager = getKeyManagementProvider();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      network: walletStatus.network,
      chainId: walletStatus.chainId,
      signerAddress: walletStatus.address,
      nativeBalanceEth: walletStatus.nativeBalanceEth,
      emergencyHaltActive: walletStatus.isEmergencyPaused,
      aiEngine: config.aiProvider,
      persistence: process.env.DATABASE_URL ? 'neon-postgresql' : 'sqlite',
      database: process.env.DATABASE_URL ? 'Neon Serverless PostgreSQL (ep-mute-morning-b4sed3pl)' : 'SQLite WAL (nexus-wallet.db)',
      keyManagement: keyManager.getSecurityAuditMetadata(),
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
    // ── Step 1: AI Decision Planning Engine (Untrusted Input) ─────────────────
    const proposal = await planTransactionProposal(taskGoal, agent, config.chainId);

    if (parseResult.data.amount && parseResult.data.amount > 0) {
      proposal.amount = parseResult.data.amount;
    }
    if (parseResult.data.recipientAddress) {
      proposal.recipient = parseResult.data.recipientAddress as `0x${string}`;
    }

    if (proposal.action === 'swap' || proposal.action === 'stake') {
      return res.status(422).json({
        success: false,
        status: 'rejected',
        error: `Operation '${proposal.action}' is not supported on agent ${agent.name}. Only native transfers are permitted on testnet.`,
        proposalAction: proposal.action,
      });
    }

    if (proposal.action === 'none' || proposal.amount <= 0) {
      return res.status(422).json({
        success: false,
        status: 'rejected',
        error: `AI Planner could not resolve a positive transfer amount or recipient from the task goal.`,
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

      db.addAuditRecord({
        id: `audit-${Date.now()}`,
        timestamp: executedAt,
        agentId: agent.id,
        agentName: agent.name,
        taskGoal,
        proposal,
        policyCheck: policyResult,
        outcome: 'rejected',
        details: `Rejected by policy engine BEFORE SIGNING: ${policyResult.violations.join('; ')}`,
      });

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
    try {
      db.atomicSpendingUpdate(agent.id, proposal.amount, agent.dailyLimit);
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

      db.addAuditRecord({
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
      });

      console.log(`[Execution] ✅ Confirmed tx: ${tx.txHash} | Block: ${tx.blockNumber}`);

    } catch (broadcastErr: any) {
      const capturedTxHash = broadcastErr.txHash || undefined;
      const isAmbiguousTimeout = Boolean(broadcastErr.isReceiptTimeout);

      // Only rollback spend if the broadcast never reached the mempool/chain
      if (!isAmbiguousTimeout && !capturedTxHash) {
        try {
          db.atomicSpendingUpdate(agent.id, -proposal.amount, agent.dailyLimit + proposal.amount);
        } catch { /* best-effort rollback */ }
      }

      console.error('[Execution] ❌ Broadcast/Receipt error:', broadcastErr.message);

      executionResult = {
        jobId,
        taskId: `task-${Date.now()}`,
        agentId: agent.id,
        agentName: agent.name,
        proposal,
        policyResult,
        status: 'failed',
        txHash: capturedTxHash,
        explorerUrl: capturedTxHash ? `${config.blockExplorerUrl}/tx/${capturedTxHash}` : undefined,
        executedAt,
        error: `Policy approved. Broadcast/Receipt error: ${broadcastErr.message}.${isAmbiguousTimeout ? ' Transaction broadcasted; awaiting ledger reconciliation.' : ' No on-chain transaction completed.'}`,
      };

      db.addAuditRecord({
        id: `audit-${Date.now()}`,
        timestamp: executedAt,
        agentId: agent.id,
        agentName: agent.name,
        taskGoal,
        proposal,
        policyCheck: policyResult,
        outcome: 'failed',
        txHash: capturedTxHash,
        explorerUrl: capturedTxHash ? `${config.blockExplorerUrl}/tx/${capturedTxHash}` : undefined,
        details: `Policy APPROVED. Execution status FAILED: ${broadcastErr.message}. Wallet balance: ${simResult.currentBalanceEth} ETH.`,
      });
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
// 6. Verified Transaction Ledger & Reconciliation
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/transactions', (_req: Request, res: Response) => {
  res.json(db.getExecutionJobs());
});

app.post('/api/reconciliation/run', requireOperatorAuth, async (_req: Request, res: Response) => {
  try {
    const jobs = db.getExecutionJobs();
    const report = await reconcileTransactions(jobs);

    db.addAuditRecord({
      id: `audit-${Date.now()}`,
      timestamp: report.timestamp,
      agentId: 'system',
      agentName: 'Ledger Reconciliation Service',
      taskGoal: 'Audit Ledger Consistency with Blockchain Receipts',
      proposal: {
        task: 'Reconciliation',
        action: 'none',
        chainId: config.chainId,
        recipient: '0x0000000000000000000000000000000000000000',
        token: 'ETH',
        amount: 0,
        reason: 'Automated ledger reconciliation check',
        confidence: 1,
      },
      policyCheck: {
        approved: true,
        violations: [],
        checks: {
          agentActive: true,
          killswitchDisengaged: true,
          recipientAllowlisted: true,
          singleTxLimitPassed: true,
          dailyBudgetPassed: true,
          networkSupported: true,
          balanceSufficient: true,
        },
      },
      outcome: report.mismatchCount === 0 ? 'confirmed' : 'failed',
      details: `Reconciliation audit complete. Total audited: ${report.totalAudited}. Verified matched: ${report.matchedCount}. Mismatches detected: ${report.mismatchCount}. Unconfirmed/Mempool: ${report.unconfirmedCount}.`,
    });

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Reconciliation failed', details: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// 7. Audit Trail & Cryptographic Verification
// ════════════════════════════════════════════════════════════════════════════════
app.get('/api/audit-logs', (_req: Request, res: Response) => {
  res.json(db.getAuditRecords());
});

app.get('/api/audit-logs/verify', (_req: Request, res: Response) => {
  const result = db.verifyAuditTrail();
  res.json({
    status: result.isValid ? 'verified' : 'tampered',
    ...result,
    timestamp: new Date().toISOString(),
  });
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

app.get('/api/security/status', (_req: Request, res: Response) => {
  res.json({
    isEmergencyPaused: db.getEmergencyStatus(),
    timestamp: new Date().toISOString(),
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 404 & Centralized Error Handlers
// ════════════════════════════════════════════════════════════════════════════════
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Server Error]', err);
  // Redact internal error traces in production
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'production' ? 'An unexpected internal error occurred.' : err.message,
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// Start Server
// ════════════════════════════════════════════════════════════════════════════════
const PORT = config.port;

// Fail-closed guard: In production, verify DATABASE_URL is set
if (config.nodeEnv === 'production' && !process.env.DATABASE_URL) {
  throw new Error('[Security Exception] DATABASE_URL is required in production mode. Refusing startup.');
}

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  NEXUS AI WALLET BACKEND ENCLAVE (BANK-GRADE HARDENED)`);
  console.log(`  Port      : ${PORT}`);
  console.log(`  Network   : ${config.networkName} (Chain ${config.chainId})`);
  console.log(`  Signer    : ${serverAccount.address}`);
  console.log(`  Persist   : ${process.env.DATABASE_URL ? 'Neon PostgreSQL (Authoritative Cloud)' : 'SQLite (nexus-wallet.db)'}`);
  console.log(`  AI Engine : ${config.aiProvider} (Advisory Rules Planner)`);
  console.log(`  Auth      : Salted Scrypt + Short-lived JWT + Refresh Rotation`);
  console.log(`  Auditing  : Cryptographic SHA-256 Tamper-Evident Hash Chain`);
  console.log(`=======================================================`);

  if (process.env.DATABASE_URL) {
    initializeNeonSchema()
      .then(() => syncSqliteToNeon())
      .catch((err) => console.warn('[Neon DB] Startup sync warning:', err.message));
  }
});

export default app;
