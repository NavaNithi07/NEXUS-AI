// src/types/index.ts

export type AgentStatus = 'active' | 'paused' | 'stopped';

export type AgentType = 
  | 'Arbitrage Bot'
  | 'DEX Liquidity'
  | 'Yield Optimizer'
  | 'DeFi Rebalancer'
  | 'Treasury Manager'
  | 'Risk Sentinel';

export interface Agent {
  id: string;
  name: string;
  description: string;
  type: AgentType | string;
  status: AgentStatus;
  balance: number;
  dailyLimit: number;
  maxTxAmount: number;
  spentToday: number;
  txCount: number;
  createdAt: string;
  lastActive: string;
  avatarIcon?: string;
  allowedRecipients?: string[];
  allowedTokens?: string[];
}

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'flagged';
export type TransactionType = 'swap' | 'transfer' | 'stake' | 'approval' | 'rebalance';

export interface Transaction {
  id: string;
  agentId?: string;
  agentName: string;
  type: TransactionType;
  amount: number;
  asset: string;
  destination: string;
  status: TransactionStatus;
  timestamp: string;
  hash: string;
  gasFee: number;
  blockNumber?: number;
  gasUsed?: number;
  calldata?: string;
  explorerUrl?: string;
  policyViolations?: string[];
}

export interface ActivityLog {
  id: string;
  agentName: string;
  action: string;
  details: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
}

export interface WalletAsset {
  symbol: string;
  name: string;
  balance: number;
  valueUsd: number;
  change24h: number;
  network: string;
  icon: string;
  contractAddress?: string;
}

export interface SpendingPolicy {
  id: string;
  name: string;
  description: string;
  targetAgent: string;
  maxDailySpend: number;
  maxSingleTx: number;
  requireApprovalAbove: number;
  allowedTokens: string[];
  status: 'active' | 'inactive';
}

export interface SystemSettings {
  rpcUrl: string;
  gasMultiplier: number;
  autoSlippage: number;
  autoPauseFailures: boolean;
  enforcePrivateRouting: boolean;
  riskTolerance: 'Conservative' | 'Moderate' | 'Aggressive';
  rebalanceFreq: string;
  discordWebhook: string;
  telegramWebhook: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  lastLogin: string;
}

