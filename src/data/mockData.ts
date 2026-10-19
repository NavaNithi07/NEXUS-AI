// src/data/mockData.ts
import type { Agent, Transaction, ActivityLog, WalletAsset, SpendingPolicy, SystemSettings } from '../types';

// Clean initial states — no dummy or fabricated data
export const initialAgents: Agent[] = [];

export const mockTransactions: Transaction[] = [];

export const mockActivityLogs: ActivityLog[] = [];

export const mockWalletAssets: WalletAsset[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    balance: 0,
    valueUsd: 0,
    change24h: 0,
    network: 'Arbitrum One',
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    contractAddress: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    balance: 0,
    valueUsd: 0,
    change24h: 0,
    network: 'Arbitrum One',
    icon: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    balance: 0,
    valueUsd: 0,
    change24h: 0,
    network: 'Arbitrum One',
    icon: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
    contractAddress: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f'
  },
  {
    symbol: 'ARB',
    name: 'Arbitrum One',
    balance: 0,
    valueUsd: 0,
    change24h: 0,
    network: 'Arbitrum One',
    icon: 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
    contractAddress: '0x912ce59144191c1204e64559fe8253a0e49e6548'
  }
];

export const mockSpendingPolicies: SpendingPolicy[] = [];

export const supportedNetworks = [
  { id: 'arb-one', name: 'Arbitrum One', chainId: 42161, gasGwei: 0.12, blockTime: '0.25s', status: 'optimal' },
  { id: 'eth-main', name: 'Ethereum Mainnet', chainId: 1, gasGwei: 14.5, blockTime: '12.0s', status: 'congested' },
  { id: 'op-main', name: 'Optimism Mainnet', chainId: 10, gasGwei: 0.08, blockTime: '2.0s', status: 'optimal' },
  { id: 'base-main', name: 'Base Network', chainId: 8453, gasGwei: 0.05, blockTime: '2.0s', status: 'optimal' },
];

export const initialSettings: SystemSettings = {
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  gasMultiplier: 1.15,
  autoSlippage: 0.35,
  autoPauseFailures: true,
  enforcePrivateRouting: true,
  riskTolerance: 'Moderate',
  rebalanceFreq: 'Every 30 mins',
  discordWebhook: '',
  telegramWebhook: '',
};

export const spendingChartData = {
  '24h': [
    { time: '00:00', spent: 0, gas: 0, profit: 0 },
    { time: '04:00', spent: 0, gas: 0, profit: 0 },
    { time: '08:00', spent: 0, gas: 0, profit: 0 },
    { time: '12:00', spent: 0, gas: 0, profit: 0 },
    { time: '16:00', spent: 0, gas: 0, profit: 0 },
    { time: '20:00', spent: 0, gas: 0, profit: 0 },
    { time: '24:00', spent: 0, gas: 0, profit: 0 },
  ],
  '7d': [
    { time: 'Mon', spent: 0, gas: 0, profit: 0 },
    { time: 'Tue', spent: 0, gas: 0, profit: 0 },
    { time: 'Wed', spent: 0, gas: 0, profit: 0 },
    { time: 'Thu', spent: 0, gas: 0, profit: 0 },
    { time: 'Fri', spent: 0, gas: 0, profit: 0 },
    { time: 'Sat', spent: 0, gas: 0, profit: 0 },
    { time: 'Sun', spent: 0, gas: 0, profit: 0 },
  ],
  '30d': [
    { time: 'Week 1', spent: 0, gas: 0, profit: 0 },
    { time: 'Week 2', spent: 0, gas: 0, profit: 0 },
    { time: 'Week 3', spent: 0, gas: 0, profit: 0 },
    { time: 'Week 4', spent: 0, gas: 0, profit: 0 },
  ],
  '90d': [
    { time: 'Month 1', spent: 0, gas: 0, profit: 0 },
    { time: 'Month 2', spent: 0, gas: 0, profit: 0 },
    { time: 'Month 3', spent: 0, gas: 0, profit: 0 },
  ]
};
