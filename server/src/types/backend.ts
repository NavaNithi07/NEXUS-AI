// server/src/types/backend.ts
import { z } from 'zod';

export type AgentStatus = 'active' | 'paused' | 'stopped';

export interface BackendAgent {
  id: string;
  name: string;
  description: string;
  type: string;
  status: AgentStatus;
  balance: number;
  dailyLimit: number;
  maxTxAmount: number;
  spentToday: number;
  txCount: number;
  createdAt: string;
  lastActive: string;
  avatarIcon?: string;
  allowedRecipients: `0x${string}`[];
  allowedTokens: string[];
}

export interface BackendSpendingPolicy {
  id: string;
  name: string;
  description: string;
  targetAgent: string; // agentId or agent name or 'all'
  maxDailySpend: number;
  maxSingleTx: number;
  requireApprovalAbove: number;
  allowedTokens: string[];
  status: 'active' | 'inactive';
}

export type ActionType = 'transfer' | 'swap' | 'stake' | 'none';

export interface TransactionProposal {
  task: string;
  action: ActionType;
  chainId: number;
  recipient: `0x${string}`;
  token: string;
  amount: number;
  reason: string;
  confidence: number;
  estimatedGasEth?: string;
}

export interface PolicyCheckResult {
  approved: boolean;
  violations: string[];
  checks: {
    agentActive: boolean;
    killswitchDisengaged: boolean;
    recipientAllowlisted: boolean;
    singleTxLimitPassed: boolean;
    dailyBudgetPassed: boolean;
    networkSupported: boolean;
    balanceSufficient: boolean;
  };
}

export interface ExecutionJobResult {
  jobId: string;
  taskId: string;
  agentId: string;
  agentName: string;
  proposal: TransactionProposal;
  policyResult: PolicyCheckResult;
  status: 'confirmed' | 'rejected' | 'failed' | 'simulated' | 'reverted' | 'submitted_pending_reconciliation';
  txHash?: `0x${string}`;
  explorerUrl?: string;
  blockNumber?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  executedAt: string;
  error?: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  taskGoal: string;
  proposal: TransactionProposal;
  policyCheck: PolicyCheckResult;
  outcome: 'confirmed' | 'rejected' | 'failed' | 'reverted' | 'submitted_pending_reconciliation';
  txHash?: `0x${string}`;
  explorerUrl?: string;
  blockNumber?: number;
  details: string;
}

export interface OnChainWalletStatus {
  address: `0x${string}`;
  chainId: number;
  network: string;
  nativeBalanceEth: string;
  nativeBalanceWei: string;
  nonce: number;
  isEmergencyPaused: boolean;
  blockExplorerUrl: string;
}

// Zod schemas for runtime input validation
export const ExecuteTaskInputSchema = z.object({
  taskGoal: z.string().min(3, 'Task description must be at least 3 characters long'),
  recipientAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid 40-character hex EVM address').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  token: z.string().default('ETH'),
});

export const AgentCreateInputSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().default(''),
  type: z.string().default('Arbitrage Bot'),
  status: z.enum(['active', 'paused', 'stopped']).default('active'),
  balance: z.number().min(0).default(0),
  dailyLimit: z.number().positive().default(1000),
  maxTxAmount: z.number().positive().default(500),
  allowedRecipients: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).default([]),
  allowedTokens: z.array(z.string()).default(['ETH', 'USDC']),
});

export const PolicyCreateInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(''),
  targetAgent: z.string().default('all'),
  maxDailySpend: z.number().positive(),
  maxSingleTx: z.number().positive(),
  requireApprovalAbove: z.number().positive().default(10000),
  allowedTokens: z.array(z.string()).default(['ETH', 'USDC']),
  status: z.enum(['active', 'inactive']).default('active'),
});
