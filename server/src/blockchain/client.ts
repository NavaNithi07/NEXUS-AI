// server/src/blockchain/client.ts
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Hash,
  type Address,
  defineChain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from '../config.js';
import type { OnChainWalletStatus } from '../types/backend.js';

// Base Sepolia chain definition
export const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [config.rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: config.blockExplorerUrl },
  },
  testnet: true,
});

// Arbitrum Sepolia fallback chain definition
export const arbitrumSepolia = defineChain({
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [config.fallbackRpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Arbiscan', url: config.fallbackBlockExplorerUrl },
  },
  testnet: true,
});

const currentChain = config.chainId === 421614 ? arbitrumSepolia : baseSepolia;

// Secure server-side account derived from environment private key
export const serverAccount = privateKeyToAccount(config.testnetPrivateKey);

// Viem Public Client for reading actual chain state
export const publicClient = createPublicClient({
  chain: currentChain,
  transport: http(config.rpcUrl, {
    retryCount: 3,
    retryDelay: 1000,
  }),
});

// Viem Wallet Client for restricted server-side transaction signing
export const walletClient = createWalletClient({
  account: serverAccount,
  chain: currentChain,
  transport: http(config.rpcUrl),
});

/**
 * Fetch real on-chain wallet status, native balance, and nonce
 */
export async function getOnChainWalletStatus(isEmergencyPaused = false): Promise<OnChainWalletStatus> {
  const address = serverAccount.address;
  let chainId: number = currentChain.id;
  let balanceWei = 0n;
  let nonce = 0;

  try {
    const [fetchedChainId, fetchedBalance, fetchedNonce] = await Promise.all([
      publicClient.getChainId().catch(() => currentChain.id),
      publicClient.getBalance({ address }).catch(() => 0n),
      publicClient.getTransactionCount({ address }).catch(() => 0),
    ]);

    chainId = fetchedChainId;
    balanceWei = fetchedBalance;
    nonce = fetchedNonce;
  } catch (err) {
    console.warn('[Blockchain] Error querying live RPC:', err);
  }

  return {
    address,
    chainId,
    network: currentChain.name,
    nativeBalanceEth: formatEther(balanceWei),
    nativeBalanceWei: balanceWei.toString(),
    nonce,
    isEmergencyPaused,
    blockExplorerUrl: `${currentChain.blockExplorers.default.url}/address/${address}`,
  };
}

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const MAX_FEE_PER_GAS_CAP = 100_000_000_000n; // 100 Gwei safety cap
export const GAS_FEE_BUFFER_PERCENT = 20n; // +20% buffer

export interface FeeEstimationDetails {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gasLimit: bigint;
  bufferedFeeEth: string;
}

/**
 * Estimate EIP-1559 fees with explicit buffer and safety cap validation
 */
export async function estimateFeesWithBuffer(client: any = publicClient): Promise<FeeEstimationDetails> {
  const chainId = await client.getChainId().catch(() => BASE_SEPOLIA_CHAIN_ID);
  if (Number(chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Execution restricted to Base Sepolia (chain ID ${BASE_SEPOLIA_CHAIN_ID}). Found chain ID: ${chainId}`);
  }

  let maxFeePerGas: bigint;
  let maxPriorityFeePerGas: bigint;

  try {
    const fees = await client.estimateFeesPerGas();
    if (fees?.maxFeePerGas && fees?.maxPriorityFeePerGas) {
      maxPriorityFeePerGas = (fees.maxPriorityFeePerGas * (100n + GAS_FEE_BUFFER_PERCENT)) / 100n;
      maxFeePerGas = (fees.maxFeePerGas * (100n + GAS_FEE_BUFFER_PERCENT)) / 100n;
    } else {
      const gasPrice = await client.getGasPrice();
      maxPriorityFeePerGas = (gasPrice * (100n + GAS_FEE_BUFFER_PERCENT)) / 100n;
      maxFeePerGas = (gasPrice * (100n + GAS_FEE_BUFFER_PERCENT)) / 100n;
    }
  } catch (err: any) {
    throw new Error(`Fee estimation failed: ${err.message}. Refusing to proceed with unreliable fee estimation.`);
  }

  // Safety fee cap enforcement
  if (maxFeePerGas > MAX_FEE_PER_GAS_CAP) {
    throw new Error(
      `Fee cap exceeded: Estimated maxFeePerGas (${formatEther(maxFeePerGas)} ETH) exceeds safety cap of ${formatEther(MAX_FEE_PER_GAS_CAP)} ETH (100 Gwei).`
    );
  }

  const gasLimit = 21000n;
  const bufferedFeeEth = formatEther(gasLimit * maxFeePerGas);

  return { maxFeePerGas, maxPriorityFeePerGas, gasLimit, bufferedFeeEth };
}

/**
 * Simulate native-token transfer and estimate gas requirements
 */
export async function simulateTransfer(to: Address, amountEth: number, client: any = publicClient): Promise<{
  estimatedGasWei: bigint;
  estimatedGasEth: string;
  sufficientBalance: boolean;
  currentBalanceEth: string;
  isSimulatedFallback: boolean;
  estimationError?: string;
}> {
  const address = serverAccount.address;
  const valueWei = parseEther(amountEth.toFixed(8));
  const currentBalance = await client.getBalance({ address }).catch(() => 0n);

  try {
    const feeInfo = await estimateFeesWithBuffer(client);
    const estimatedGasWei = feeInfo.gasLimit * feeInfo.maxFeePerGas;
    const totalRequiredWei = valueWei + estimatedGasWei;

    return {
      estimatedGasWei,
      estimatedGasEth: formatEther(estimatedGasWei),
      sufficientBalance: currentBalance >= totalRequiredWei,
      currentBalanceEth: formatEther(currentBalance),
      isSimulatedFallback: false,
    };
  } catch (err: any) {
    // If estimation fails, return clearly marked simulation error result instead of silent 1 gwei fallback
    return {
      estimatedGasWei: 0n,
      estimatedGasEth: '0',
      sufficientBalance: false,
      currentBalanceEth: formatEther(currentBalance),
      isSimulatedFallback: true,
      estimationError: err.message,
    };
  }
}

/**
 * Sign and broadcast an authorized testnet transaction on-chain
 */
export async function sendNativeToken(
  to: Address,
  amountEth: number
): Promise<{
  txHash: Hash;
  blockNumber: number;
  gasUsed: string;
  effectiveGasPrice: string;
  explorerUrl: string;
}> {
  // Strict chain ID check before signing
  const chainId = await publicClient.getChainId().catch(() => BASE_SEPOLIA_CHAIN_ID);
  if (Number(chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Chain restriction violation: Execution is strictly restricted to Base Sepolia (chain ID ${BASE_SEPOLIA_CHAIN_ID}). Detected chain ID: ${chainId}`);
  }

  // Calculate fees with buffer and validate cap
  const feeInfo = await estimateFeesWithBuffer(publicClient);

  const valueWei = parseEther(amountEth.toFixed(8));
  
  console.log(`[Blockchain] Signing transaction: ${amountEth} ETH -> ${to} on ${currentChain.name} (maxFeePerGas: ${feeInfo.maxFeePerGas} wei)`);

  // Broadcast to live testnet with validated EIP-1559 fees
  const txHash = await walletClient.sendTransaction({
    to,
    value: valueWei,
    maxFeePerGas: feeInfo.maxFeePerGas,
    maxPriorityFeePerGas: feeInfo.maxPriorityFeePerGas,
    chain: baseSepolia,
  } as any);

  console.log(`[Blockchain] Broadcasted with hash: ${txHash}. Awaiting receipt...`);

  // Wait for 1 confirmation with fail-safe error attribution
  let receipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 30000,
    });
  } catch (receiptErr: any) {
    const errorWithHash = new Error(
      `Transaction submitted with hash ${txHash}, but receipt confirmation timed out or failed: ${receiptErr.message}`
    );
    (errorWithHash as any).txHash = txHash;
    (errorWithHash as any).isReceiptTimeout = true;
    throw errorWithHash;
  }

  // Strict status verification: on-chain execution MUST have status === 'success'
  if (receipt.status !== 'success') {
    const revertError = new Error(
      `Transaction execution REVERTED on-chain. Status: ${receipt.status}, hash: ${txHash}, block: ${receipt.blockNumber}`
    );
    (revertError as any).txHash = txHash;
    (revertError as any).receipt = receipt;
    throw revertError;
  }

  const blockNumber = Number(receipt.blockNumber);
  const gasUsed = receipt.gasUsed.toString();
  const effectiveGasPrice = receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : '0';
  const explorerUrl = `${currentChain.blockExplorers.default.url}/tx/${txHash}`;

  console.log(`[Blockchain] Confirmed in block #${blockNumber}. Gas used: ${gasUsed}`);

  return {
    txHash,
    blockNumber,
    gasUsed,
    effectiveGasPrice,
    explorerUrl,
  };
}
