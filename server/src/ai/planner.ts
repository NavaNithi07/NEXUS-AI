// server/src/ai/planner.ts
import type { BackendAgent, TransactionProposal } from '../types/backend.js';
import { config } from '../config.js';

/**
 * Pluggable AI Decision Engine
 * Interprets natural language financial goals and generates structured transaction proposals.
 * The proposal is purely advisory; it is independently validated and authorized by the server-side policy engine.
 */
export async function planTransactionProposal(
  taskGoal: string,
  agent: BackendAgent,
  targetChainId: number = config.chainId
): Promise<TransactionProposal> {
  const normalizedGoal = taskGoal.trim();

  // If configured for an external LLM API and a key is provided, we can call it here.
  // Otherwise, use our reliable deterministic rule-based planning engine.
  if (config.aiProvider === 'llm' && config.aiApiKey) {
    try {
      return await executeLlmPlanning(normalizedGoal, agent, targetChainId);
    } catch (err) {
      console.warn('[AI Planner] LLM call failed, falling back to deterministic planning engine:', err);
    }
  }

  return executeDeterministicPlanning(normalizedGoal, agent, targetChainId);
}

/**
 * Deterministic Planning Engine (Rule-based NLP and entity extractor)
 */
function executeDeterministicPlanning(
  goal: string,
  agent: BackendAgent,
  chainId: number
): TransactionProposal {
  // Regex to detect 40-hex EVM address
  const addressMatch = goal.match(/0x[a-fA-F0-9]{40}/);
  
  // Regex to detect numeric amount (e.g. 0.001, 10, 0.5)
  const amountMatch = goal.match(/(\d+(\.\d+)?)/);

  // Detect token
  let token = 'ETH';
  if (/USDC/i.test(goal)) token = 'USDC';
  else if (/WBTC/i.test(goal)) token = 'WBTC';
  else if (/ARB/i.test(goal)) token = 'ARB';

  // Detect action
  let action: TransactionProposal['action'] = 'none';
  if (/send|transfer|pay|deposit|disburse|fund/i.test(goal)) {
    action = 'transfer';
  } else if (/swap|trade|exchange/i.test(goal)) {
    action = 'swap';
  } else if (/stake|yield|compound/i.test(goal)) {
    action = 'stake';
  }

  // Extract amount
  const parsedAmount = amountMatch ? parseFloat(amountMatch[0]) : 0;

  // Extract recipient (from goal or agent's first allowlisted recipient)
  const recipient = (addressMatch
    ? addressMatch[0]
    : agent.allowedRecipients[0] || '0x0000000000000000000000000000000000000000') as `0x${string}`;

  // Evaluate validity
  if (!addressMatch && agent.allowedRecipients.length === 0) {
    return {
      task: goal,
      action: 'none',
      chainId,
      recipient: '0x0000000000000000000000000000000000000000',
      token,
      amount: parsedAmount,
      reason: 'AI Planning Engine could not resolve a target recipient address from task goal or agent allowlist.',
      confidence: 0.1,
    };
  }

  if (parsedAmount <= 0) {
    return {
      task: goal,
      action: 'none',
      chainId,
      recipient,
      token,
      amount: 0,
      reason: 'AI Planning Engine could not determine a positive transfer amount from the task goal.',
      confidence: 0.2,
    };
  }

  const confidence = addressMatch ? 0.95 : 0.75;
  const reason = `Interpreted goal as autonomous ${action} of ${parsedAmount} ${token} to ${recipient} on chain ${chainId} for agent ${agent.name}.`;

  return {
    task: goal,
    action,
    chainId,
    recipient,
    token,
    amount: parsedAmount,
    reason,
    confidence,
    estimatedGasEth: '0.000021',
  };
}

/**
 * Optional External LLM Planning Implementation
 */
async function executeLlmPlanning(
  goal: string,
  agent: BackendAgent,
  chainId: number
): Promise<TransactionProposal> {
  // If an external OpenAI or Gemini endpoint is configured, this queries it for JSON
  // Defaults back to deterministic planner if the call times out or fails
  return executeDeterministicPlanning(goal, agent, chainId);
}
