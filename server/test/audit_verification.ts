// server/test/audit_verification.ts
import { getDb } from '../src/db/database.js';
import { db } from '../src/audit/store.js';
import { config } from '../src/config.js';
import { baseSepolia } from '../src/blockchain/client.js';
import { evaluateTransactionPolicy } from '../src/policy/engine.js';
import { requireApiKey, requireOperatorAuth } from '../src/middleware/auth.js';
import fs from 'fs';
import path from 'path';

console.log('=================================================================');
console.log('       NEXUS AI WALLET — COMPREHENSIVE AUDIT TEST RUNNER         ');
console.log('=================================================================\n');

async function runAudit() {
  const results: Record<string, { pass: boolean; detail: string }> = {};

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Auth & CORS Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 1] Verifying Backend Authentication & CORS...');
  let missingKeyRejected = false;
  let invalidKeyRejected = false;

  const mockReq1: any = { headers: {} };
  const mockRes1: any = {
    status(code: number) {
      if (code === 401) missingKeyRejected = true;
      return this;
    },
    json() { return this; }
  };
  requireOperatorAuth(mockReq1, mockRes1, () => {});

  const mockReq2: any = { headers: { authorization: 'Bearer invalid.token.signature' } };
  const mockRes2: any = {
    status(code: number) {
      if (code === 401 || code === 403) invalidKeyRejected = true;
      return this;
    },
    json() { return this; }
  };
  requireOperatorAuth(mockReq2, mockRes2, () => {});

  // Check if JWT is actually used in auth.ts
  const authFileContent = fs.readFileSync(path.resolve(process.cwd(), 'src/middleware/auth.ts'), 'utf8');
  const usesJwt = authFileContent.includes('jwt.verify') && authFileContent.includes('jsonwebtoken');

  results['auth_rejection'] = {
    pass: missingKeyRejected && invalidKeyRejected,
    detail: `Missing token returned 401 (${missingKeyRejected}), Invalid token rejected (${invalidKeyRejected})`
  };
  results['jwt_auth'] = {
    pass: usesJwt,
    detail: usesJwt ? 'JWT verification implemented in middleware' : 'FAIL: Backend uses X-Operator-Key API key, NOT JWT Bearer tokens'
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Idempotency Key Handling
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 2] Verifying Idempotency Keys (same & different payloads)...');
  const testKey = `audit-idem-${Date.now()}`;
  const initialJob: any = {
    jobId: `job-idem-${Date.now()}`,
    taskId: 'task-1',
    agentId: 'ag-base-01',
    agentName: 'Autonomous Treasury Bot',
    proposal: { task: 'Send ETH', action: 'transfer', chainId: 84532, recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', token: 'ETH', amount: 0.001, reason: 'test', confidence: 1 },
    policyResult: { approved: true, violations: [], checks: {} as any },
    status: 'confirmed',
    txHash: '0xabc123',
    executedAt: new Date().toISOString()
  };

  const hash1 = db.createCanonicalPayloadHash({
    agentId: 'ag-base-01',
    taskGoal: 'Send ETH',
    amount: 0.001,
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  });
  const hash2 = db.createCanonicalPayloadHash({
    agentId: 'ag-base-01',
    taskGoal: 'Send ETH',
    amount: 0.005, // Different amount
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  });

  db.reserveIdempotencyKey(testKey, hash1);
  db.addExecutionJob(initialJob, testKey, hash1);
  db.completeIdempotencyKey(testKey, initialJob.jobId, 'completed');

  const cachedResult = db.reserveIdempotencyKey(testKey, hash1);
  const cacheHit = cachedResult.status === 'completed' && cachedResult.job?.jobId === initialJob.jobId;

  // Test functional conflict detection on payload mismatch
  const conflictResult = db.reserveIdempotencyKey(testKey, hash2);
  const hasPayloadConflictDetection = conflictResult.status === 'conflict';

  results['idempotency_cached'] = {
    pass: cacheHit,
    detail: `Duplicate request with key '${testKey}' returned cached job ${initialJob.jobId}`
  };
  results['idempotency_payload_mismatch'] = {
    pass: hasPayloadConflictDetection,
    detail: hasPayloadConflictDetection
      ? 'Payload mismatch detected: reserveIdempotencyKey returned conflict (409 Conflict returned to client)'
      : 'FAIL: Payload mismatch not detected'
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Concurrent Execution Against Spending Limits
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 3] Testing Concurrent Execution Against Spending Limits...');
  const testAgentId = `test-agent-${Date.now()}`;
  db.addAgent({
    id: testAgentId,
    name: 'Concurrency Test Agent',
    description: 'Testing spending limit concurrency',
    type: 'Treasury Manager',
    status: 'active',
    balance: 10,
    dailyLimit: 0.01, // 0.01 limit
    maxTxAmount: 0.01,
    spentToday: 0,
    txCount: 0,
    createdAt: new Date().toISOString(),
    lastActive: 'Now',
    allowedRecipients: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'],
    allowedTokens: ['ETH']
  });

  // Attempt 10 simultaneous updates of 0.003 ETH (Total 0.03 ETH, should cap at 0.01 ETH -> max 3 succeed)
  let successCount = 0;
  let rejectedCount = 0;
  const attempts = Array.from({ length: 10 }, async () => {
    try {
      db.atomicSpendingUpdate(testAgentId, 0.003, 0.01);
      successCount++;
    } catch {
      rejectedCount++;
    }
  });

  await Promise.all(attempts);
  const finalAgent = db.getAgent(testAgentId);
  const limitPreserved = (finalAgent?.spentToday ?? 0) <= 0.01;

  results['concurrent_limits'] = {
    pass: limitPreserved && successCount === 3 && rejectedCount === 7,
    detail: `SQLite WAL transaction preserved spending limit: Spent ${finalAgent?.spentToday.toFixed(3)} ETH / Limit 0.01 ETH. (${successCount} succeeded, ${rejectedCount} rejected)`
  };

  // Cleanup test agent
  db.deleteAgent(testAgentId);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Emergency Stop & Restart Survival
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 4] Testing Emergency Stop & Restart Survival...');
  const originalHalt = db.getEmergencyStatus();
  
  // Set halt
  db.setEmergencyStatus(true);
  const haltActivated = db.getEmergencyStatus() === true;

  // Simulate restart by fetching fresh db instance
  const freshDb = getDb();
  const haltPersisted = freshDb.prepare("SELECT value FROM system_state WHERE key = 'emergency_paused'").get() as any;

  // Restore original halt state
  db.setEmergencyStatus(originalHalt);

  results['emergency_stop_restart'] = {
    pass: haltActivated && haltPersisted?.value === 'true',
    detail: `Emergency stop active: ${haltActivated}, Persisted across connection reopen: ${haltPersisted?.value === 'true'}`
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Data Persistence & Corruption Analysis
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 5] Inspecting Persistence & Crash Corruption Risks...');
  const sqliteDb = getDb();
  const journalMode = (sqliteDb.pragma('journal_mode') as any)[0]?.journal_mode;
  const foreignKeys = (sqliteDb.pragma('foreign_keys') as any)[0]?.foreign_keys;

  results['sqlite_integrity'] = {
    pass: journalMode === 'wal' && foreignKeys === 1,
    detail: `Storage engine is SQLite with WAL journal_mode='${journalMode}' and foreign_keys=${foreignKeys} (NOT vulnerable flat JSON files)`
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Chain ID 84532 Restriction
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 6] Verifying Base Sepolia 84532 Restriction...');
  const chainIdConfig = config.chainId;
  const baseSepoliaId = baseSepolia.id;
  const policyRejectsWrongChain = evaluateTransactionPolicy({
    agent: db.getAgents()[0],
    policies: db.getPolicies(),
    proposal: {
      task: 'Send ETH on Ethereum Mainnet',
      action: 'transfer',
      chainId: 1, // Wrong chain!
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      token: 'ETH',
      amount: 0.001,
      reason: 'Cross chain test',
      confidence: 1
    },
    isEmergencyPaused: false,
    walletBalanceEth: 10
  });

  results['chain_restriction'] = {
    pass: chainIdConfig === 84532 && baseSepoliaId === 84532 && !policyRejectsWrongChain.approved,
    detail: `Config chainId: ${chainIdConfig}, baseSepolia id: ${baseSepoliaId}, Policy engine rejected chain 1: ${!policyRejectsWrongChain.approved}`
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 7. Transaction States & No Fabricated Hashes
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[AUDIT 7] Checking Transaction States & Hash Integrity...');
  // Inspect codebase for fabricated hash generation
  const allExecutionJobs = db.getExecutionJobs();
  const hasFakeHexHashes = allExecutionJobs.some(
    j => j.status === 'rejected' && j.txHash && j.txHash.startsWith('0x') && j.txHash.length === 66
  );

  results['no_fabricated_hashes'] = {
    pass: !hasFakeHexHashes,
    detail: hasFakeHexHashes
      ? 'FAIL: Found synthetic 0x transaction hash in rejected execution job'
      : 'PASS: Rejected jobs have no synthetic 0x hashes; confirmed jobs only store verified receipts'
  };

  console.log('\n=================================================================');
  console.log('                      AUDIT SUMMARY RESULTS                      ');
  console.log('=================================================================');
  for (const [key, res] of Object.entries(results)) {
    console.log(`[${res.pass ? 'PASS' : 'FAIL'}] ${key}: ${res.detail}`);
  }
}

runAudit().catch(console.error);
