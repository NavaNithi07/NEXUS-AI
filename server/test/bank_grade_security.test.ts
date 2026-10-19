// server/test/bank_grade_security.test.ts
// Comprehensive validation of Bank-Grade Security Controls:
// 1. Salted Scrypt Password Hashing & Verification
// 2. Account Lockout & Brute-Force Protection
// 3. Refresh Token Rotation & Replay Attack Defense
// 4. Cryptographic Tamper-Evident Hash Chain & Tamper Detection
// 5. Enterprise Key Management Provider Isolation & Fail-Closed Guards
// 6. Blockchain Ledger Reconciliation & Discrepancy Auditing

import {
  hashPassword,
  verifyPassword,
  recordFailedAttempt,
  checkAccountLockout,
  clearFailedAttempts,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../src/auth/service.js';
import {
  computeRecordHash,
  verifyAuditChainIntegrity,
  GENESIS_HASH,
  type ChainedAuditRecord,
} from '../src/audit/hashChain.js';
import {
  LocalTestnetSignerProvider,
  CloudKmsHsmProvider,
  type TransactionSigningRequest,
} from '../src/blockchain/keyManagement.js';
import { reconcileTransactions } from '../src/blockchain/reconciliation.js';
import { config } from '../src/config.js';
import type { ExecutionJobResult } from '../src/types/backend.js';

console.log('=================================================================');
console.log('  NEXUS AI WALLET — BANK-GRADE SECURITY VERIFICATION SUITE       ');
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

async function runBankGradeTests() {
  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: SCRYPT PASSWORD HASHING & VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('--- SUITE 1: Salted Scrypt Password Hashing & Verification ---');

  const testPassword = 'StrongVaultPassword!_2026';
  const hashed = await hashPassword(testPassword);

  assert(hashed.includes(':') && hashed.split(':')[0].length === 32,
    'Scrypt hashing generates salt:key format with 16-byte random salt');

  const isValidMatch = await verifyPassword(testPassword, hashed);
  assert(isValidMatch === true, 'Valid password verified successfully against salted scrypt hash');

  const isInvalidMatch = await verifyPassword('WrongPassword123', hashed);
  assert(isInvalidMatch === false, 'Invalid password rejected by scrypt verification');

  const hashedAgain = await hashPassword(testPassword);
  assert(hashed !== hashedAgain, 'Identical passwords produce different hashes due to unique cryptographic salts');

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: ACCOUNT LOCKOUT & BRUTE-FORCE DEFENSE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- SUITE 2: Account Lockout & Brute-Force Defense ---');

  const testUser = `lockout-test-${Date.now()}@nexus.ai`;

  // First 4 failed attempts should not lock out
  for (let i = 1; i <= 4; i++) {
    const res = recordFailedAttempt(testUser);
    assert(!res.isNowLocked && res.remainingAttempts === 5 - i,
      `Failed attempt ${i} recorded, ${res.remainingAttempts} attempts remaining`);
  }

  // 5th attempt triggers lockout
  const fifthAttempt = recordFailedAttempt(testUser);
  assert(fifthAttempt.isNowLocked === true && fifthAttempt.remainingAttempts === 0,
    'Fifth consecutive failed attempt engages account lockout');

  const lockoutStatus = checkAccountLockout(testUser);
  assert(lockoutStatus.isLocked === true && lockoutStatus.remainingSeconds > 800,
    'Locked account check returns active lockout with remaining cooldown seconds (> 800s)');

  // Clear attempts on recovery
  clearFailedAttempts(testUser);
  const clearedStatus = checkAccountLockout(testUser);
  assert(clearedStatus.isLocked === false, 'Account lockout cleared upon verified credential recovery');

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: REFRESH TOKEN ROTATION & REVOCATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- SUITE 3: Session Refresh Token Rotation & Replay Defense ---');

  const userContext = { userId: 'usr-vault-01', email: 'vault@nexus.ai', role: 'operator' as const };
  const { refreshToken: token1 } = generateRefreshToken(userContext);

  assert(typeof token1 === 'string' && token1.length === 64,
    'Generated refresh token is a 64-character (32-byte) high-entropy cryptographic hex token');

  // Rotate token 1 -> token 2
  const rotation1 = rotateRefreshToken(token1);
  assert(rotation1.valid === true && !!rotation1.newRefreshToken,
    'Refresh token rotated successfully into new token pair');

  // Attempt replay attack with old token 1 -> MUST BE REJECTED
  const replayAttempt = rotateRefreshToken(token1);
  assert(replayAttempt.valid === false && Boolean(replayAttempt.error?.includes('revoked') || replayAttempt.error?.includes('reuse')),
    'Reusing an already-rotated refresh token is detected and blocked as replay attack');

  // Revoke token on logout
  const { refreshToken: tokenToRevoke } = generateRefreshToken(userContext);
  const revoked = revokeRefreshToken(tokenToRevoke);
  assert(revoked === true, 'Refresh token explicitly revoked upon user logout');

  const postLogoutAttempt = rotateRefreshToken(tokenToRevoke);
  assert(postLogoutAttempt.valid === false, 'Revoked token rejected on subsequent access attempts');

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: CRYPTOGRAPHIC TAMPER-EVIDENT HASH CHAIN
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- SUITE 4: Cryptographic Tamper-Evident Audit Hash Chain ---');

  const recordA: Omit<ChainedAuditRecord, 'recordHash'> = {
    id: 'audit-001',
    sequenceNumber: 1,
    prevHash: GENESIS_HASH,
    timestamp: '2026-10-19T10:00:00Z',
    agentId: 'ag-base-01',
    agentName: 'Autonomous Treasury Bot',
    taskGoal: 'Rebalance gas reserve',
    proposal: { task: 'Send ETH', action: 'transfer', chainId: 84532, recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', token: 'ETH', amount: 0.001, reason: 'Gas reserve', confidence: 1 },
    policyCheck: { approved: true, violations: [], checks: {} as any },
    outcome: 'confirmed',
    txHash: '0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999',
    details: 'Transaction confirmed in block #123456',
  };
  const hashA = computeRecordHash(GENESIS_HASH, recordA);
  const chainedA: ChainedAuditRecord = { ...recordA, recordHash: hashA };

  const recordB: Omit<ChainedAuditRecord, 'recordHash'> = {
    id: 'audit-002',
    sequenceNumber: 2,
    prevHash: hashA,
    timestamp: '2026-10-19T10:05:00Z',
    agentId: 'ag-base-01',
    agentName: 'Autonomous Treasury Bot',
    taskGoal: 'Disburse testnet bounty',
    proposal: { task: 'Send ETH', action: 'transfer', chainId: 84532, recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', token: 'ETH', amount: 0.002, reason: 'Bounty', confidence: 1 },
    policyCheck: { approved: true, violations: [], checks: {} as any },
    outcome: 'confirmed',
    txHash: '0xbbbbccccddddeeeeffff0000111122223333444455556666777788889999aaaa',
    details: 'Transaction confirmed in block #123458',
  };
  const hashB = computeRecordHash(hashA, recordB);
  const chainedB: ChainedAuditRecord = { ...recordB, recordHash: hashB };

  // Verification of untampered chain
  const chainAuditResult = verifyAuditChainIntegrity([chainedA, chainedB]);
  assert(chainAuditResult.isValid === true && chainAuditResult.totalRecords === 2,
    'Untampered 2-block audit chain verified with 100% cryptographic integrity');
  assert(chainAuditResult.headHash === hashB, 'Head hash correctly reflects latest block digest');

  // Tamper simulation: Alter record A details post-hoc
  const tamperedA: ChainedAuditRecord = {
    ...chainedA,
    details: 'Tampered malicious alteration of record details!',
  };
  const tamperedResult = verifyAuditChainIntegrity([tamperedA, chainedB]);
  assert(tamperedResult.isValid === false && tamperedResult.corruptedRecordId === 'audit-001',
    'Post-hoc record modification immediately detected and pinpointed by audit chain verification');

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 5: KEY MANAGEMENT PROVIDER & FAIL-CLOSED GUARDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- SUITE 5: Enterprise Key Management & Fail-Closed Guards ---');

  const testSigner = new LocalTestnetSignerProvider(config.testnetPrivateKey);
  const meta = testSigner.getSecurityAuditMetadata();

  assert(meta.allowedChains.includes(84532) && !meta.allowedChains.includes(1),
    'Local testnet signer is explicitly restricted to testnet chains and strictly excludes Ethereum Mainnet (Chain 1)');
  assert(testSigner.isProductionReady === false,
    'Testnet signer is unambiguously flagged as isProductionReady = false');

  // Attempting to sign for Ethereum Mainnet (Chain 1) -> MUST THROW
  let mainnetSigningRejected = false;
  try {
    await testSigner.signAndBroadcast({
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: 1000n,
      chainId: 1, // Mainnet!
    });
  } catch (err: any) {
    mainnetSigningRejected = err.message.includes('Unauthorized chain ID') || err.message.includes('Security Violation');
  }
  assert(mainnetSigningRejected === true, 'Testnet signer fails closed and strictly rejects signing requests for Ethereum Mainnet');

  // Cloud KMS fails closed when cloud credentials not present
  const kmsProvider = new CloudKmsHsmProvider();
  let kmsFailedClosed = false;
  try {
    await kmsProvider.signAndBroadcast({
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      value: 1000n,
      chainId: 84532,
    });
  } catch (err: any) {
    kmsFailedClosed = err.message.includes('Fail-Closed');
  }
  assert(kmsFailedClosed === true, 'Cloud KMS provider safely fails closed when enterprise credentials are not provisioned');

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 6: BLOCKCHAIN RECONCILIATION ENGINE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n--- SUITE 6: Blockchain Reconciliation & Discrepancy Auditing ---');

  const mockJobs: ExecutionJobResult[] = [
    {
      jobId: 'rec-job-01',
      taskId: 'task-rec-01',
      agentId: 'ag-base-01',
      agentName: 'Autonomous Treasury Bot',
      proposal: { task: 'Send ETH', action: 'transfer', chainId: 84532, recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', token: 'ETH', amount: 0.001, reason: 'Test', confidence: 1 },
      policyResult: { approved: true, violations: [], checks: {} as any },
      status: 'confirmed',
      txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      executedAt: new Date().toISOString(),
    },
  ];

  const report = await reconcileTransactions(mockJobs);
  assert(report.totalAudited === 1 && typeof report.unconfirmedCount === 'number',
    'Reconciliation engine completed on-chain receipt audit and generated structured discrepancy report');

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n=================================================================');
  console.log(`  BANK-GRADE SECURITY RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('=================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runBankGradeTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
