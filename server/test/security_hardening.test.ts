// server/test/security_hardening.test.ts
// Comprehensive unit & integration tests for JWT Auth, Idempotency Integrity, and Gas Estimation

import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';
import {
  signAccessToken,
  requireAuth,
  requireOperatorAuth,
} from '../src/middleware/auth.js';
import { db, createCanonicalPayloadHash } from '../src/audit/store.js';
import { getDb } from '../src/db/database.js';
import {
  estimateFeesWithBuffer,
  MAX_FEE_PER_GAS_CAP,
  BASE_SEPOLIA_CHAIN_ID,
} from '../src/blockchain/client.js';

console.log('=================================================================');
console.log('  NEXUS AI WALLET — SECURITY HARDENING & REGRESSION TEST SUITE   ');
console.log('=================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failCount++;
  }
}

async function runSecurityTests() {
  // ══════════════════════════════════════════════════════════════════════════
  // TASK 1: JWT AUTHENTICATION & RBAC TESTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- TASK 1: JWT Authentication & Role-Based Authorization ---');

  // Test 1.1: Missing Token
  {
    let statusCode = 0;
    let responseBody: any = null;
    const req: any = { headers: {} };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { responseBody = data; return this; },
    };
    let nextCalled = false;
    requireOperatorAuth(req, res, () => { nextCalled = true; });

    assert(statusCode === 401 && !nextCalled, 'Missing Bearer token rejected with HTTP 401', `Status: ${statusCode}`);
  }

  // Test 1.2: Invalid / Forged Token
  {
    let statusCode = 0;
    const req: any = { headers: { authorization: 'Bearer forged.invalid.token' } };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      json() { return this; },
    };
    let nextCalled = false;
    requireOperatorAuth(req, res, () => { nextCalled = true; });

    assert(statusCode === 401 && !nextCalled, 'Forged/invalid JWT token rejected with HTTP 401', `Status: ${statusCode}`);
  }

  // Test 1.3: Expired Token
  {
    let statusCode = 0;
    let responseBody: any = null;
    const expiredToken = jwt.sign(
      { userId: 'usr-exp', email: 'exp@nexus.ai', role: 'operator' },
      config.jwtSecret,
      { expiresIn: '-10s', algorithm: 'HS256' }
    );

    const req: any = { headers: { authorization: `Bearer ${expiredToken}` } };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { responseBody = data; return this; },
    };
    let nextCalled = false;
    requireOperatorAuth(req, res, () => { nextCalled = true; });

    assert(statusCode === 401 && responseBody?.code === 'TOKEN_EXPIRED' && !nextCalled,
      'Expired JWT token rejected with HTTP 401 and TOKEN_EXPIRED code',
      `Status: ${statusCode}, Code: ${responseBody?.code}`);
  }

  // Test 1.4: Insufficient Roles (viewer role attempting operator action)
  {
    let statusCode = 0;
    let responseBody: any = null;
    const viewerToken = signAccessToken({
      userId: 'usr-viewer',
      email: 'viewer@nexus.ai',
      role: 'viewer',
      name: 'Auditor Viewer',
    });

    const req: any = { headers: { authorization: `Bearer ${viewerToken}` } };
    const res: any = {
      status(code: number) { statusCode = code; return this; },
      json(data: any) { responseBody = data; return this; },
    };
    let nextCalled = false;
    requireOperatorAuth(req, res, () => { nextCalled = true; });

    assert(statusCode === 403 && !nextCalled, 'Insufficient role (viewer) rejected with HTTP 403 Forbidden', `Status: ${statusCode}`);
  }

  // Test 1.5: Valid Authorized Token (operator role)
  {
    const operatorToken = signAccessToken({
      userId: 'usr-op-01',
      email: 'operator@nexus.ai',
      role: 'operator',
      name: 'Lead Operator',
    });

    let nextCalled = false;
    const req: any = { headers: { authorization: `Bearer ${operatorToken}` } };
    const res: any = {
      status() { return this; },
      json() { return this; },
    };
    requireOperatorAuth(req, res, () => { nextCalled = true; });

    assert(nextCalled && req.user?.email === 'operator@nexus.ai', 'Valid operator JWT authorized and decoded into request context');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 2: IDEMPOTENCY PAYLOAD INTEGRITY TESTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- TASK 2: Idempotency Payload Integrity & Concurrency ---');

  const testKey = `sec-test-idem-${Date.now()}`;
  const payload1 = {
    agentId: 'ag-base-01',
    taskGoal: 'Transfer 0.002 ETH for gas reserves',
    recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    amount: 0.002,
    token: 'ETH',
    chainId: 84532,
  };
  const hash1 = createCanonicalPayloadHash(payload1);

  // Test 2.1: Key reservation & successful completion
  {
    const res = db.reserveIdempotencyKey(testKey, hash1);
    assert(res.status === 'reserved', 'Idempotency key successfully reserved');

    const sampleJob: any = {
      jobId: `job-${Date.now()}`,
      taskId: 'task-100',
      agentId: 'ag-base-01',
      agentName: 'Autonomous Treasury Bot',
      proposal: { ...payload1, action: 'transfer', reason: 'test', confidence: 1 },
      policyResult: { approved: true, violations: [], checks: {} as any },
      status: 'confirmed',
      txHash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
      executedAt: new Date().toISOString(),
    };

    db.addExecutionJob(sampleJob, testKey, hash1);
    db.completeIdempotencyKey(testKey, sampleJob.jobId, 'completed');
  }

  // Test 2.2: Duplicate request with same key and SAME payload -> returns completed job
  {
    const dupRes = db.reserveIdempotencyKey(testKey, hash1);
    assert(dupRes.status === 'completed' && dupRes.job !== undefined,
      'Duplicate request with same payload returns cached completed job without re-execution');
  }

  // Test 2.3: Duplicate request with same key and DIFFERENT payload -> returns conflict
  {
    const payloadDifferent = {
      ...payload1,
      amount: 0.005, // Different amount!
    };
    const hashDifferent = createCanonicalPayloadHash(payloadDifferent);
    const conflictRes = db.reserveIdempotencyKey(testKey, hashDifferent);

    assert(conflictRes.status === 'conflict', 'Duplicate request with modified payload detected as conflict (409)');
  }

  // Test 2.4: Canonical property order independence
  {
    const hashOrderedA = createCanonicalPayloadHash({
      agentId: 'ag-base-01',
      taskGoal: 'Send ETH',
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 0.001,
      token: 'ETH',
      chainId: 84532,
    });

    const hashOrderedB = createCanonicalPayloadHash({
      chainId: 84532,
      token: 'ETH',
      amount: 0.001,
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      taskGoal: 'Send ETH',
      agentId: 'ag-base-01',
    });

    assert(hashOrderedA === hashOrderedB, 'Canonical payload hashing is independent of object key order');
  }

  // Test 2.5: Concurrent duplicate reservation protection
  {
    const concurrentKey = `concurrent-${Date.now()}`;
    const concurrentHash = createCanonicalPayloadHash(payload1);

    const firstAttempt = db.reserveIdempotencyKey(concurrentKey, concurrentHash);
    const secondAttempt = db.reserveIdempotencyKey(concurrentKey, concurrentHash);

    assert(firstAttempt.status === 'reserved' && secondAttempt.status === 'in_flight',
      'Concurrent duplicate requests with same key protected; second attempt receives in_flight status');

    db.releaseIdempotencyKey(concurrentKey);
  }

  // Test 2.6: Persistence across database connection restart
  {
    const freshDb = getDb();
    const row = freshDb.prepare('SELECT * FROM idempotency_records WHERE key = ?').get(testKey) as any;
    assert(row?.status === 'completed' && row?.payload_hash === hash1,
      'Idempotency key and payload hash survive backend connection restart');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TASK 3: GAS ESTIMATION & FEE CAP ENFORCEMENT TESTS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- TASK 3: Gas Fee Estimation, Buffer, and Cap Enforcement ---');

  // Test 3.1: Successful fee estimation with dynamic buffer (+20%)
  {
    const mockClient: any = {
      getChainId: async () => BASE_SEPOLIA_CHAIN_ID,
      estimateFeesPerGas: async () => ({
        maxFeePerGas: 1_000_000_000n, // 1 Gwei
        maxPriorityFeePerGas: 100_000_000n, // 0.1 Gwei
      }),
    };

    const fees = await estimateFeesWithBuffer(mockClient);
    assert(fees.maxFeePerGas === 1_200_000_000n, 'Dynamic fee estimation applies explicit +20% buffer (1.0 -> 1.2 Gwei)');
    assert(fees.maxPriorityFeePerGas === 120_000_000n, 'Priority fee estimation applies explicit +20% buffer (0.1 -> 0.12 Gwei)');
  }

  // Test 3.2: Fee estimation failure throws clear error (no silent 1 gwei fallback)
  {
    const mockClientFail: any = {
      getChainId: async () => BASE_SEPOLIA_CHAIN_ID,
      estimateFeesPerGas: async () => { throw new Error('RPC connection timed out'); },
    };

    let threw = false;
    let errorMessage = '';
    try {
      await estimateFeesWithBuffer(mockClientFail);
    } catch (err: any) {
      threw = true;
      errorMessage = err.message;
    }

    assert(threw && errorMessage.includes('Fee estimation failed'),
      'Fee estimation failure throws clear error rather than silently defaulting to 1 gwei');
  }

  // Test 3.3: Fee cap enforcement (> 100 Gwei rejected)
  {
    const mockClientSpike: any = {
      getChainId: async () => BASE_SEPOLIA_CHAIN_ID,
      estimateFeesPerGas: async () => ({
        maxFeePerGas: 150_000_000_000n, // 150 Gwei (above 100 Gwei safety cap)
        maxPriorityFeePerGas: 10_000_000_000n,
      }),
    };

    let capTriggered = false;
    let capError = '';
    try {
      await estimateFeesWithBuffer(mockClientSpike);
    } catch (err: any) {
      capTriggered = true;
      capError = err.message;
    }

    assert(capTriggered && capError.includes('Fee cap exceeded'),
      'Excessive gas fee (> 100 Gwei) is safely blocked by fee cap enforcement');
  }

  // Test 3.4: Chain ID restriction (only Base Sepolia 84532 permitted)
  {
    const mockWrongChainClient: any = {
      getChainId: async () => 1, // Ethereum Mainnet
      estimateFeesPerGas: async () => ({ maxFeePerGas: 1000n, maxPriorityFeePerGas: 100n }),
    };

    let chainRejected = false;
    try {
      await estimateFeesWithBuffer(mockWrongChainClient);
    } catch (err: any) {
      chainRejected = true;
    }

    assert(chainRejected, 'Gas estimation strictly blocks unauthorized chains (non-84532)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=================================================================');
  console.log(`  SECURITY TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
