// server/test/e2e.test.ts
import { evaluateTransactionPolicy } from '../src/policy/engine.js';
import { planTransactionProposal } from '../src/ai/planner.js';
import { getOnChainWalletStatus, simulateTransfer } from '../src/blockchain/client.js';
import type { BackendAgent, BackendSpendingPolicy, TransactionProposal } from '../src/types/backend.js';

async function runTestSuite() {
  console.log('=================================================================');
  console.log('  NEXUS AI WALLET — BACKEND & POLICY ENGINE TEST SUITE');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  const testAgent: BackendAgent = {
    id: 'ag-test-01',
    name: 'Arbitrage Alpha Bot',
    description: 'Autonomous flash arbitrage bot',
    type: 'Arbitrage Bot',
    status: 'active',
    balance: 500,
    dailyLimit: 0.05,
    maxTxAmount: 0.01,
    spentToday: 0.005,
    txCount: 2,
    createdAt: '2026-10-18',
    lastActive: 'Just now',
    allowedRecipients: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8'],
    allowedTokens: ['ETH', 'USDC'],
  };

  const testPolicy: BackendSpendingPolicy = {
    id: 'pol-01',
    name: 'Single Tx Cap',
    description: 'Enforces hard 0.01 ETH ceiling',
    targetAgent: 'all',
    maxDailySpend: 0.05,
    maxSingleTx: 0.01,
    requireApprovalAbove: 0.008,
    allowedTokens: ['ETH', 'USDC'],
    status: 'active',
  };

  // Test 1: AI Planning Engine interprets natural language goal
  console.log('Scenario 1: AI Planning Engine');
  const proposal = await planTransactionProposal(
    'Send 0.002 ETH to approved recipient 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for gas rebalancing',
    testAgent,
    84532
  );
  assert(proposal.action === 'transfer', 'AI interprets action as transfer');
  assert(proposal.amount === 0.002, 'AI accurately extracts amount (0.002 ETH)');
  assert(proposal.recipient.toLowerCase() === '0x70997970c51812dc3a010c7d01b50e0d17dc79c8', 'AI extracts valid recipient address');
  assert(proposal.confidence >= 0.7, 'AI produces confident proposal score');

  // Test 2: Valid proposal within all limits is approved
  console.log('\nScenario 2: Policy Engine Approval for Authorized Goal');
  const validCheck = evaluateTransactionPolicy({
    agent: testAgent,
    policies: [testPolicy],
    proposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.05,
  });
  assert(validCheck.approved === true, 'Valid proposal is approved by policy engine');
  assert(validCheck.violations.length === 0, 'No policy violations recorded');

  // Test 3: Single-Transaction Limit Violation
  console.log('\nScenario 3: Single-Transaction Cap Enforcement');
  const excessiveTxProposal: TransactionProposal = {
    ...proposal,
    amount: 0.02, // Exceeds 0.01 maxSingleTx
  };
  const singleTxCheck = evaluateTransactionPolicy({
    agent: testAgent,
    policies: [testPolicy],
    proposal: excessiveTxProposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.1,
  });
  assert(singleTxCheck.approved === false, 'Transaction above single-tx cap is rejected before signing');
  assert(singleTxCheck.checks.singleTxLimitPassed === false, 'Single-tx limit check flags violation');
  assert(singleTxCheck.violations.some((v) => v.includes('maximum single-transaction limit')), 'Exact violation reason logged');

  // Test 4: Daily Budget Violation
  console.log('\nScenario 4: Daily Spending Velocity / Budget Enforcement');
  const excessiveDailyProposal: TransactionProposal = {
    ...proposal,
    amount: 0.009, // agent already spent 0.005 -> total 0.014 is ok. But if spentToday is 0.045 -> 0.045 + 0.009 = 0.054 > 0.05!
  };
  const agentNearCap: BackendAgent = {
    ...testAgent,
    spentToday: 0.045,
  };
  const dailyCheck = evaluateTransactionPolicy({
    agent: agentNearCap,
    policies: [testPolicy],
    proposal: excessiveDailyProposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.1,
  });
  assert(dailyCheck.approved === false, 'Transaction exceeding remaining daily budget is rejected');
  assert(dailyCheck.checks.dailyBudgetPassed === false, 'Daily budget check flags violation');

  // Test 5: Unapproved Recipient Address Rejection
  console.log('\nScenario 5: Recipient Allowlist Enforcement');
  const unknownRecipientProposal: TransactionProposal = {
    ...proposal,
    recipient: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Not in testAgent.allowedRecipients
  };
  const recipientCheck = evaluateTransactionPolicy({
    agent: testAgent,
    policies: [testPolicy],
    proposal: unknownRecipientProposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.1,
  });
  assert(recipientCheck.approved === false, 'Transfer to unapproved recipient is rejected before signing');
  assert(recipientCheck.checks.recipientAllowlisted === false, 'Recipient allowlist check flags violation');

  // Test 6: Paused Agent Rejection
  console.log('\nScenario 6: Agent Paused Status Enforcement');
  const pausedAgent: BackendAgent = {
    ...testAgent,
    status: 'paused',
  };
  const pausedCheck = evaluateTransactionPolicy({
    agent: pausedAgent,
    policies: [testPolicy],
    proposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.1,
  });
  assert(pausedCheck.approved === false, 'Paused agent cannot execute transactions');
  assert(pausedCheck.checks.agentActive === false, 'Agent active check flags violation');

  // Test 7: Emergency Killswitch Halt Enforcement
  console.log('\nScenario 7: Global Emergency Killswitch');
  const killswitchCheck = evaluateTransactionPolicy({
    agent: testAgent,
    policies: [testPolicy],
    proposal,
    isEmergencyPaused: true, // Emergency halt active!
    walletBalanceEth: 0.1,
  });
  assert(killswitchCheck.approved === false, 'Emergency pause blocks all new transactions');
  assert(killswitchCheck.checks.killswitchDisengaged === false, 'Killswitch check flags emergency halt');

  // Test 8: Insufficient Balance Check
  console.log('\nScenario 8: Insufficient Balance Protection');
  const insufficientBalanceCheck = evaluateTransactionPolicy({
    agent: testAgent,
    policies: [testPolicy],
    proposal,
    isEmergencyPaused: false,
    walletBalanceEth: 0.0001, // Less than proposal.amount 0.002
  });
  assert(insufficientBalanceCheck.approved === false, 'Insufficient balance is rejected before signing');
  assert(insufficientBalanceCheck.checks.balanceSufficient === false, 'Balance check flags insufficient funds');

  // Test 9: Real On-Chain RPC Query
  console.log('\nScenario 9: Live Blockchain RPC Reading');
  try {
    const onChainStatus = await getOnChainWalletStatus();
    assert(onChainStatus.chainId === 84532 || onChainStatus.chainId === 421614, `Chain ID verified: ${onChainStatus.chainId} (${onChainStatus.network})`);
    assert(onChainStatus.address.startsWith('0x') && onChainStatus.address.length === 42, `Wallet address verified: ${onChainStatus.address}`);
    assert(typeof onChainStatus.nativeBalanceEth === 'string', `Native balance parsed: ${onChainStatus.nativeBalanceEth} ETH`);
    assert(typeof onChainStatus.nonce === 'number', `Nonce queried: ${onChainStatus.nonce}`);
  } catch (err: any) {
    console.warn('  ! RPC Query Note:', err.message);
  }

  // Summary
  console.log('\n=================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
