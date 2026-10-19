// server/test/transaction_builder.test.ts
import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateProposedTransaction,
  computePayloadHash,
  simulateAndPrepareTransaction,
} from '../src/blockchain/simulator.js';
import { BASE_SEPOLIA_CHAIN_ID, serverAccount } from '../src/blockchain/client.js';
import type { BackendAgent, BackendSpendingPolicy } from '../src/types/backend.js';

console.log('=================================================================');
console.log('  NEXUS AI WALLET — TRANSACTION BUILDER & SIMULATOR SUITE        ');
console.log('=================================================================');

const mockAgent: BackendAgent = {
  id: 'agt-test-builder',
  name: 'Treasury Safe Transfer Enclave',
  status: 'active',
  role: 'Treasury Safe Transfer',
  maxTxAmount: 0.1,
  dailyLimit: 0.5,
  spentToday: 0.0,
  allowedTokens: ['ETH'],
  allowedRecipients: ['0x1111111111111111111111111111111111111111'],
};

const mockPolicies: BackendSpendingPolicy[] = [
  {
    id: 'pol-builder-global',
    name: 'Safe Transfer Ceiling',
    maxSingleTx: 0.1,
    maxDailySpend: 0.5,
    allowedTokens: ['ETH'],
    targetAgent: 'all',
    status: 'active',
  },
];

test('--- SUITE 1: Input Validation, Address Verification & Chain Guards ---', async () => {
  // Test 1.1: Valid inputs pass
  const valid = validateProposedTransaction({
    recipient: '0x1111111111111111111111111111111111111111',
    amountEth: 0.05,
    calldata: '0x',
    chainId: 84532,
  });
  assert.strictEqual(valid.recipient, '0x1111111111111111111111111111111111111111');
  assert.strictEqual(valid.amountEth, 0.05);
  assert.strictEqual(valid.chainId, 84532);
  console.log('  ✓ PASS: Valid transaction inputs pass strict validation');

  // Test 1.2: Rejects non-Base-Sepolia chain ID
  assert.throws(
    () => {
      validateProposedTransaction({
        recipient: '0x1111111111111111111111111111111111111111',
        amountEth: 0.05,
        chainId: 1, // Mainnet
      });
    },
    /Chain mismatch/,
    'Mainnet chain ID 1 strictly rejected'
  );
  console.log('  ✓ PASS: Ethereum Mainnet (Chain 1) strictly rejected');

  // Test 1.3: Rejects invalid recipient address format
  assert.throws(
    () => {
      validateProposedTransaction({
        recipient: '0xInvalidAddressNotHex40Chars',
        amountEth: 0.05,
        chainId: 84532,
      });
    },
    /Invalid recipient address/,
    'Malformed recipient rejected'
  );
  console.log('  ✓ PASS: Malformed non-hex recipient address rejected');

  // Test 1.4: Rejects zero or negative amounts
  assert.throws(
    () => {
      validateProposedTransaction({
        recipient: '0x1111111111111111111111111111111111111111',
        amountEth: 0,
        chainId: 84532,
      });
    },
    /Invalid transfer amount/,
    'Zero amount rejected'
  );

  assert.throws(
    () => {
      validateProposedTransaction({
        recipient: '0x1111111111111111111111111111111111111111',
        amountEth: -0.01,
        chainId: 84532,
      });
    },
    /Invalid transfer amount/,
    'Negative amount rejected'
  );
  console.log('  ✓ PASS: Zero and negative amounts strictly rejected');

  // Test 1.5: Rejects malformed calldata
  assert.throws(
    () => {
      validateProposedTransaction({
        recipient: '0x1111111111111111111111111111111111111111',
        amountEth: 0.01,
        calldata: '0x123', // Odd length
        chainId: 84532,
      });
    },
    /Invalid calldata/,
    'Odd length calldata rejected'
  );
  console.log('  ✓ PASS: Malformed odd-length calldata rejected');
});

test('--- SUITE 2: Tamper-Evident Binding Hash ---', async () => {
  const hash1 = computePayloadHash({
    chainId: 84532,
    from: serverAccount.address,
    to: '0x1111111111111111111111111111111111111111',
    amountEth: 0.01,
    calldata: '0x',
  });

  const hash2 = computePayloadHash({
    chainId: 84532,
    from: serverAccount.address,
    to: '0x1111111111111111111111111111111111111111',
    amountEth: 0.01,
    calldata: '0x',
  });

  assert.strictEqual(hash1, hash2, 'Identical payloads produce matching binding hash');
  assert.strictEqual(hash1.length, 64, 'SHA-256 payload hash is 64 hex characters');

  // Altering amount produces completely different hash
  const alteredHash = computePayloadHash({
    chainId: 84532,
    from: serverAccount.address,
    to: '0x1111111111111111111111111111111111111111',
    amountEth: 0.02, // Changed amount
    calldata: '0x',
  });

  assert.notStrictEqual(hash1, alteredHash, 'Payload modification alters binding hash');
  console.log('  ✓ PASS: Cryptographic binding hash strictly binds simulated parameters');
});

test('--- SUITE 3: Simulation Workflow & Policy Engine Enforcement ---', async () => {
  // Test 3.1: Simulation runs and includes mandatory security disclaimers
  const simResult = await simulateAndPrepareTransaction(
    {
      recipient: '0x1111111111111111111111111111111111111111',
      amountEth: 0.005,
      calldata: '0x',
      chainId: 84532,
    },
    {
      agent: mockAgent,
      policies: mockPolicies,
      isEmergencyPaused: false,
    }
  );

  assert.strictEqual(simResult.chainId, 84532);
  assert.strictEqual(simResult.network, 'Base Sepolia');
  assert(simResult.warnings.some((w) => w.includes('Simulation is not a guarantee of future on-chain execution')),
    'Mandatory simulation disclaimer present');
  console.log('  ✓ PASS: Simulation successfully executed with mandatory security disclaimer');

  // Test 3.2: Single transaction cap policy enforcement
  const overCapResult = await simulateAndPrepareTransaction(
    {
      recipient: '0x1111111111111111111111111111111111111111',
      amountEth: 0.5, // Exceeds maxSingleTx (0.1)
      calldata: '0x',
      chainId: 84532,
    },
    {
      agent: mockAgent,
      policies: mockPolicies,
      isEmergencyPaused: false,
    }
  );

  assert.strictEqual(overCapResult.policyResult.approved, false);
  assert(overCapResult.policyResult.violations.some((v) => v.includes('exceeds the maximum single-transaction limit')),
    'Single transaction limit violation recorded');
  console.log('  ✓ PASS: Transaction exceeding single-tx cap rejected by policy engine');

  // Test 3.3: Recipient allowlist enforcement
  const nonAllowlistedResult = await simulateAndPrepareTransaction(
    {
      recipient: '0x9999999999999999999999999999999999999999', // Not on allowlist
      amountEth: 0.01,
      calldata: '0x',
      chainId: 84532,
    },
    {
      agent: mockAgent,
      policies: mockPolicies,
      isEmergencyPaused: false,
    }
  );

  assert.strictEqual(nonAllowlistedResult.policyResult.approved, false);
  assert(nonAllowlistedResult.policyResult.violations.some((v) => v.includes('not in the approved allowlist')),
    'Recipient allowlist violation recorded');
  console.log('  ✓ PASS: Non-allowlisted recipient rejected by policy engine');

  // Test 3.4: Emergency stop halts simulation authorization
  const emergencyHaltResult = await simulateAndPrepareTransaction(
    {
      recipient: '0x1111111111111111111111111111111111111111',
      amountEth: 0.01,
      calldata: '0x',
      chainId: 84532,
    },
    {
      agent: mockAgent,
      policies: mockPolicies,
      isEmergencyPaused: true, // Emergency halt active
    }
  );

  assert.strictEqual(emergencyHaltResult.policyResult.approved, false);
  assert(emergencyHaltResult.policyResult.violations.some((v) => v.includes('Global Emergency Halt is ACTIVE')),
    'Emergency halt violation recorded');
  console.log('  ✓ PASS: Emergency stop circuit breaker blocks policy approval');
});

test('--- SUITE 4: Safe BigInt Gas & Affordability Calculations ---', async () => {
  const sim = await simulateAndPrepareTransaction(
    {
      recipient: '0x1111111111111111111111111111111111111111',
      amountEth: 0.01,
      calldata: '0x',
      chainId: 84532,
    },
    {
      agent: mockAgent,
      policies: mockPolicies,
      isEmergencyPaused: false,
    }
  );

  assert(BigInt(sim.gas.gasLimit) >= 21000n, 'Gas limit is at least 21000');
  assert(parseFloat(sim.gas.maxFeeEth) > 0, 'Max fee calculated in ETH');
  assert(parseFloat(sim.gas.maxTotalCostEth) > 0.01, 'Max total cost includes amount plus fee');
  assert(typeof sim.affordability.sufficientForMaxCost === 'boolean', 'Affordability evaluation is boolean');
  console.log('  ✓ PASS: Safe BigInt arithmetic computes gas limit, max fee, and total cost');
});
