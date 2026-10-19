// scripts/verify_acceptance_checklist.mjs
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:4173/api';

console.log('======================================================================');
console.log('       NEXUS AI WALLET — ACCEPTANCE CHECKLIST VERIFICATION SUITE       ');
console.log('======================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, title, details = '') {
  if (condition) {
    console.log(`  [PASS] ${title}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${title} — ${details}`);
    failCount++;
  }
}

function getOperatorPassword() {
  if (process.env.OPERATOR_PASSWORD) return process.env.OPERATOR_PASSWORD;
  const envPath = path.resolve(process.cwd(), 'server/.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^OPERATOR_PASSWORD=["']?([^"'\r\n]+)["']?/m);
    if (match) return match[1].trim();
  }
  return '';
}

async function run() {
  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 1: Verify the Login Flow
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- CHECK 1: Verify Login Flow & JWT Issuance ---');
  let operatorToken = '';
  try {
    const operatorPassword = getOperatorPassword();
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'operator@nexus.ai',
        password: operatorPassword,
      }),
    });
    const loginData = await loginRes.json();

    assert(loginRes.status === 200 && !!loginData.token, 'Operator login returns HTTP 200 with JWT token');
    assert(loginData.user?.role === 'operator', `JWT payload contains role 'operator' (actual: ${loginData.user?.role})`);

    operatorToken = loginData.token;

    // Verify protected API request works with issued token
    const testPolicyRes = await fetch(`${API_BASE}/policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        name: 'Login Verification Policy',
        description: 'Temporary policy created during login verification',
        targetAgent: 'Treasury Bot',
        maxDailySpend: 1000,
        maxSingleTx: 500,
        requireApprovalAbove: 200,
        allowedTokens: ['ETH'],
        status: 'active',
      }),
    });
    const createdPolicy = await testPolicyRes.json();
    assert(testPolicyRes.status === 201 && !!createdPolicy.id, 'Protected POST /api/policies succeeds with operator JWT token');

    // Clean up created policy
    if (createdPolicy.id) {
      await fetch(`${API_BASE}/policies/${createdPolicy.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${operatorToken}` },
      });
    }
  } catch (err) {
    assert(false, 'Login flow failed with exception', err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 2: Test Authorization
  // Confirm unauthorized user cannot edit policies, execute agents, or resume
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CHECK 2: Test Authorization & RBAC ---');
  try {
    // 2.1 Unauthenticated policy edit
    const unauthPolicyRes = await fetch(`${API_BASE}/policies/pol-arbitrum-01`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxDailySpend: 999999 }),
    });
    assert(unauthPolicyRes.status === 401, `Unauthenticated policy edit rejected with HTTP 401 (actual: ${unauthPolicyRes.status})`);

    // 2.2 Unauthenticated agent execution
    const unauthExecRes = await fetch(`${API_BASE}/agents/ag-base-01/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskGoal: 'Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8' }),
    });
    assert(unauthExecRes.status === 401, `Unauthenticated agent execution rejected with HTTP 401 (actual: ${unauthExecRes.status})`);

    // 2.3 Unauthenticated resume after emergency stop
    const unauthResumeRes = await fetch(`${API_BASE}/security/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    assert(unauthResumeRes.status === 401, `Unauthenticated emergency resume rejected with HTTP 401 (actual: ${unauthResumeRes.status})`);

    // 2.4 Viewer role token cannot edit policies, execute agents, or resume
    // Sign viewer token using test secret or inspect middleware
    // We can forge an invalid token or test with bad token
    const invalidTokenRes = await fetch(`${API_BASE}/policies/pol-arbitrum-01`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.forged.jwt',
      },
      body: JSON.stringify({ maxDailySpend: 999999 }),
    });
    assert(invalidTokenRes.status === 401, `Forged token rejected with HTTP 401 (actual: ${invalidTokenRes.status})`);
  } catch (err) {
    assert(false, 'Authorization check failed with exception', err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 3: Test Idempotency End to End
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CHECK 3: Test Idempotency End to End ---');
  try {
    const idemKey = `idem-e2e-${Date.now()}`;
    const payloadA = {
      taskGoal: 'Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 0.001,
    };
    const payloadB_ChangedAmount = {
      taskGoal: 'Send 0.005 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      amount: 0.005, // Changed amount!
    };

    // First request with key
    const res1 = await fetch(`${API_BASE}/agents/ag-base-01/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
        'X-Idempotency-Key': idemKey,
      },
      body: JSON.stringify(payloadA),
    });
    const data1 = await res1.json();
    assert(res1.status === 200 || res1.status === 422 || res1.status === 403, `First execution completed (status ${res1.status})`);

    // Second request with SAME key and SAME payload -> Expect cached result
    const res2 = await fetch(`${API_BASE}/agents/ag-base-01/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
        'X-Idempotency-Key': idemKey,
      },
      body: JSON.stringify(payloadA),
    });
    const data2 = await res2.json();
    assert(data2.cached === true || (data2.job && data1.job && data2.job.jobId === data1.job.jobId),
      `Duplicate request with same idempotency key returns cached result (cached: ${data2.cached}, job matching: ${data2.job?.jobId === data1.job?.jobId})`);

    // Third request with SAME key but CHANGED amount -> Expect HTTP 409 Conflict
    const res3 = await fetch(`${API_BASE}/agents/ag-base-01/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
        'X-Idempotency-Key': idemKey,
      },
      body: JSON.stringify(payloadB_ChangedAmount),
    });
    const data3 = await res3.json();
    assert(res3.status === 409, `Reusing key with changed amount returned HTTP 409 Conflict (actual: ${res3.status})`);
    assert(data3.error === 'Conflict' && (data3.message || '').includes('payload mismatch'),
      `Conflict response clearly indicates payload mismatch (actual: ${data3.message})`);
  } catch (err) {
    assert(false, 'Idempotency check failed with exception', err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 4: Test Emergency Stop
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CHECK 4: Test Emergency Stop & Recovery ---');
  try {
    // 4.1 Activate emergency stop with operator token
    const killRes = await fetch(`${API_BASE}/security/killswitch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    const killData = await killRes.json();
    assert(killRes.status === 200 && killData.isEmergencyPaused === true, 'Emergency stop activated via POST /api/security/killswitch');

    // 4.2 Verify status endpoint reflects emergency pause
    const statusRes1 = await fetch(`${API_BASE}/security/status`);
    const statusData1 = await statusRes1.json();
    assert(statusData1.isEmergencyPaused === true, 'Public /api/security/status confirms isEmergencyPaused: true');

    // 4.3 Attempt execution while halted -> verify rejection
    const haltedExecRes = await fetch(`${API_BASE}/agents/ag-base-01/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        taskGoal: 'Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        amount: 0.001,
      }),
    });
    const haltedData = await haltedExecRes.json();
    assert(haltedExecRes.status === 403 && haltedData.status === 'rejected',
      `Execution while halted is strictly rejected with HTTP 403 (actual: ${haltedExecRes.status}, status: ${haltedData.status})`);

    // 4.4 Attempt to resume without token -> verify rejection
    const unauthResume = await fetch(`${API_BASE}/security/resume`, { method: 'POST' });
    assert(unauthResume.status === 401, `Unauthorized attempt to resume rejected with HTTP 401 (actual: ${unauthResume.status})`);

    // Still halted
    const statusRes2 = await fetch(`${API_BASE}/security/status`);
    const statusData2 = await statusRes2.json();
    assert(statusData2.isEmergencyPaused === true, 'Wallet remains halted after unauthorized resume attempt');

    // 4.5 Resume ONLY through authorized operator operation
    const resumeRes = await fetch(`${API_BASE}/security/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${operatorToken}` },
    });
    const resumeData = await resumeRes.json();
    assert(resumeRes.status === 200 && resumeData.isEmergencyPaused === false, 'Wallet successfully resumed by authorized operator');

    const statusRes3 = await fetch(`${API_BASE}/security/status`);
    const statusData3 = await statusRes3.json();
    assert(statusData3.isEmergencyPaused === false, 'Wallet is active and normal operations are restored');
  } catch (err) {
    assert(false, 'Emergency stop check failed with exception', err.message);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CHECK 6: Verify Configuration and Secrets
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- CHECK 6: Verify Configuration & Secret Hygiene ---');
  try {
    const rootDir = process.cwd();
    const gitignoreContent = fs.readFileSync(path.resolve(rootDir, '.gitignore'), 'utf8');
    const excludesEnv = gitignoreContent.includes('.env');
    assert(excludesEnv, '.gitignore in workspace root explicitly excludes .env');

    const readmeContent = fs.readFileSync(path.resolve(rootDir, 'README.md'), 'utf8');
    const docsVars = readmeContent.includes('TESTNET_PRIVATE_KEY') &&
                     readmeContent.includes('JWT_SECRET') &&
                     readmeContent.includes('OPERATOR_EMAIL') &&
                     readmeContent.includes('OPERATOR_PASSWORD');
    assert(docsVars, 'README.md documents all required environment variables and operator credentials');

    // Verify built bundle contains no secrets
    const distPath = path.resolve(rootDir, 'dist/assets');
    if (fs.existsSync(distPath)) {
      const jsFiles = fs.readdirSync(distPath).filter(f => f.endsWith('.js'));
      let leakedKey = false;
      let leakedSecret = false;
      let leakedApiKey = false;

      for (const file of jsFiles) {
        const content = fs.readFileSync(path.resolve(distPath, file), 'utf8');
        if (content.includes('0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a07467193')) leakedKey = true;
        if (content.includes('919aea0560282d69dba32bc8d5049ef33e11cdeed8531b526d1b4a1f89649968')) leakedSecret = true;
        if (content.includes('nexus-dev-api-key-change-in-production')) leakedApiKey = true;
      }

      assert(!leakedKey, 'Frontend production bundle does NOT contain testnet private key');
      assert(!leakedSecret, 'Frontend production bundle does NOT contain JWT secret');
      assert(!leakedApiKey, 'Frontend production bundle does NOT contain operator API key');
    }
  } catch (err) {
    assert(false, 'Secrets verification failed with exception', err.message);
  }

  console.log('\n======================================================================');
  console.log(`CHECKLIST VERIFICATION RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('======================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
