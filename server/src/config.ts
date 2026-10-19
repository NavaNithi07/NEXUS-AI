// server/src/config.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  chainId: number;
  networkName: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  fallbackChainId: number;
  fallbackNetworkName: string;
  fallbackRpcUrl: string;
  fallbackBlockExplorerUrl: string;
  testnetPrivateKey: `0x${string}`;
  operatorApiKey: string;
  aiProvider: 'deterministic' | 'llm';
  aiApiKey?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  operatorEmail: string;
  operatorPassword: string;
}

const rawKey = process.env.TESTNET_PRIVATE_KEY || '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a07467193';
const formattedKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;

export const config: AppConfig = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  chainId: Number(process.env.CHAIN_ID) || 84532,
  networkName: process.env.NETWORK_NAME || 'Base Sepolia',
  rpcUrl: process.env.RPC_URL || 'https://sepolia.base.org',
  blockExplorerUrl: process.env.BLOCK_EXPLORER_URL || 'https://sepolia.basescan.org',
  fallbackChainId: Number(process.env.FALLBACK_CHAIN_ID) || 421614,
  fallbackNetworkName: process.env.FALLBACK_NETWORK_NAME || 'Arbitrum Sepolia',
  fallbackRpcUrl: process.env.FALLBACK_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
  fallbackBlockExplorerUrl: process.env.FALLBACK_BLOCK_EXPLORER_URL || 'https://sepolia.arbiscan.io',
  testnetPrivateKey: formattedKey,
  operatorApiKey: process.env.OPERATOR_API_KEY || 'nexus-dev-api-key-change-in-production',
  aiProvider: (process.env.AI_PROVIDER === 'llm' ? 'llm' : 'deterministic'),
  aiApiKey: process.env.AI_API_KEY || undefined,
  jwtSecret: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim().length < 16) {
      throw new Error('[Security Config Error] JWT_SECRET environment variable is required and must be at least 16 characters. Refusing to start with missing or default secret.');
    }
    return secret.trim();
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  operatorEmail: process.env.OPERATOR_EMAIL || 'operator@nexus.ai',
  operatorPassword: (() => {
    const pass = process.env.OPERATOR_PASSWORD;
    if (!pass || pass.trim().length < 8) {
      throw new Error('[Security Config Error] OPERATOR_PASSWORD environment variable is required and must be at least 8 characters.');
    }
    return pass.trim();
  })(),
};

