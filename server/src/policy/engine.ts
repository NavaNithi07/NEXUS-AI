// server/src/policy/engine.ts
import type { BackendAgent, BackendSpendingPolicy, TransactionProposal, PolicyCheckResult } from '../types/backend.js';

export interface PolicyEvaluationContext {
  agent: BackendAgent;
  policies: BackendSpendingPolicy[];
  proposal: TransactionProposal;
  isEmergencyPaused: boolean;
  walletBalanceEth: number;
}

/**
 * Independent Server-Side Policy Enforcement Engine
 * The policy engine independently verifies all proposals against safety rules.
 * If any check fails, execution is halted immediately BEFORE wallet signing.
 */
export function evaluateTransactionPolicy(context: PolicyEvaluationContext): PolicyCheckResult {
  const { agent, policies, proposal, isEmergencyPaused, walletBalanceEth } = context;
  const violations: string[] = [];

  // 1. Agent Status Check
  const agentActive = agent.status === 'active';
  if (!agentActive) {
    violations.push(`Agent '${agent.name}' is ${agent.status.toUpperCase()} and cannot execute transactions.`);
  }

  // 2. Global Emergency Circuit Breaker Check
  const killswitchDisengaged = !isEmergencyPaused;
  if (!killswitchDisengaged) {
    violations.push('Global Emergency Halt is ACTIVE. All autonomous on-chain execution is blocked.');
  }

  // 3. Supported Network Check
  const networkSupported = proposal.chainId === 84532 || proposal.chainId === 421614;
  if (!networkSupported) {
    violations.push(`Chain ID ${proposal.chainId} is unsupported. Only authorized testnets are permitted.`);
  }

  // Find applicable policies (either targeting this agent specifically or 'all')
  const applicablePolicies = policies.filter(
    (p) => p.status === 'active' && (p.targetAgent === 'all' || p.targetAgent === agent.id || p.targetAgent === agent.name)
  );

  // 4. Maximum Single-Transaction Cap Check
  let maxSingleTx = agent.maxTxAmount;
  for (const pol of applicablePolicies) {
    if (pol.maxSingleTx < maxSingleTx) {
      maxSingleTx = pol.maxSingleTx;
    }
  }

  const singleTxLimitPassed = proposal.amount <= maxSingleTx;
  if (!singleTxLimitPassed) {
    violations.push(
      `Transaction amount (${proposal.amount} ${proposal.token}) exceeds the maximum single-transaction limit of ${maxSingleTx} ${proposal.token}.`
    );
  }

  // 5. Daily Spending Velocity / Budget Check
  let maxDailyBudget = agent.dailyLimit;
  for (const pol of applicablePolicies) {
    if (pol.maxDailySpend < maxDailyBudget) {
      maxDailyBudget = pol.maxDailySpend;
    }
  }

  const projectedDailySpend = agent.spentToday + proposal.amount;
  const dailyBudgetPassed = projectedDailySpend <= maxDailyBudget;
  if (!dailyBudgetPassed) {
    violations.push(
      `Projected daily spend (${projectedDailySpend.toFixed(4)} ${proposal.token}) exceeds daily budget cap of ${maxDailyBudget} ${proposal.token} (Already spent today: ${agent.spentToday} ${proposal.token}).`
    );
  }

  // 6. Recipient Allowlist Check
  const normalizedRecipient = proposal.recipient.toLowerCase();
  const allowlist = agent.allowedRecipients.map((r) => r.toLowerCase());
  
  // If agent has an explicit allowlist, recipient must be on it
  const recipientAllowlisted = allowlist.length === 0 || allowlist.includes(normalizedRecipient);
  if (!recipientAllowlisted) {
    violations.push(`Recipient address '${proposal.recipient}' is not in the approved allowlist for agent '${agent.name}'.`);
  }

  // 7. Token Whitelist Check
  const tokenAllowed = agent.allowedTokens.includes(proposal.token);
  if (!tokenAllowed) {
    violations.push(`Asset '${proposal.token}' is not an authorized token for agent '${agent.name}'.`);
  }

  // 8. Balance & Gas Sufficiency Check
  const balanceSufficient = walletBalanceEth >= proposal.amount;
  if (!balanceSufficient) {
    violations.push(
      `Insufficient testnet wallet balance: Required ${proposal.amount} ${proposal.token}, but wallet currently holds ${walletBalanceEth.toFixed(4)} ${proposal.token}.`
    );
  }

  const approved =
    agentActive &&
    killswitchDisengaged &&
    networkSupported &&
    singleTxLimitPassed &&
    dailyBudgetPassed &&
    recipientAllowlisted &&
    tokenAllowed &&
    balanceSufficient;

  return {
    approved,
    violations,
    checks: {
      agentActive,
      killswitchDisengaged,
      recipientAllowlisted,
      singleTxLimitPassed,
      dailyBudgetPassed,
      networkSupported,
      balanceSufficient,
    },
  };
}
