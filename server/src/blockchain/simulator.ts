// server/src/blockchain/simulator.ts
import {
  formatEther,
  parseEther,
  type Address,
  type Hash,
  isAddress,
  toHex,
} from 'viem';
import crypto from 'crypto';
import { publicClient, serverAccount, estimateFeesWithBuffer, BASE_SEPOLIA_CHAIN_ID } from './client.js';
import { config } from '../config.js';
import { evaluateTransactionPolicy } from '../policy/engine.js';
import type { BackendAgent, BackendSpendingPolicy, PolicyCheckResult } from '../types/backend.js';

export interface ProposedTransactionInput {
  recipient: string;
  amountEth: number | string;
  calldata?: string;
  chainId: number;
  agentId?: string;
}

export interface SimulatedAssetChange {
  assetType: 'NATIVE' | 'ERC20' | 'ERC721' | 'ERC1155';
  changeType: 'TRANSFER' | 'APPROVE' | 'MINT' | 'BURN';
  from: string;
  to: string;
  rawAmount: string;
  amount: string;
  symbol: string;
  decimals?: number;
  contractAddress?: string | null;
}

export interface SimulationResult {
  valid: boolean;
  chainId: number;
  network: string;
  sender: Address;
  recipient: Address;
  amountEth: number;
  calldata: `0x${string}`;
  simulation: {
    outcome: 'success' | 'failed' | 'unsupported_provider' | 'timeout';
    provider: 'alchemy' | 'evm_call' | 'none';
    assetChanges: SimulatedAssetChange[];
    gasUsed?: string;
    rawError?: string;
  };
  gas: {
    gasLimit: string;
    maxFeePerGasWei: string;
    maxPriorityFeePerGasWei: string;
    maxFeePerGasGwei: string;
    estimatedFeeEth: string;
    maxFeeEth: string;
    maxTotalCostEth: string;
  };
  affordability: {
    currentBalanceEth: string;
    currentBalanceWei: string;
    sufficientForValue: boolean;
    sufficientForMaxCost: boolean;
    shortfallEth?: string;
  };
  policyResult: PolicyCheckResult;
  warnings: string[];
  preparedPayloadHash: string;
  timestamp: string;
}

/**
 * Validate proposed transaction inputs fail-closed
 */
export function validateProposedTransaction(input: ProposedTransactionInput): {
  recipient: Address;
  amountEth: number;
  calldata: `0x${string}`;
  chainId: number;
} {
  if (!input) {
    throw new Error('Transaction input is required');
  }

  // 1. Chain ID strict validation
  if (Number(input.chainId) !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Chain mismatch: Simulation strictly restricted to Base Sepolia (chain ID ${BASE_SEPOLIA_CHAIN_ID}). Provided: ${input.chainId}`);
  }

  // 2. Recipient address validation (EIP-55 / hex format)
  if (!input.recipient || typeof input.recipient !== 'string') {
    throw new Error('Recipient address is required');
  }
  const cleanRecipient = input.recipient.trim();
  if (!isAddress(cleanRecipient)) {
    throw new Error(`Invalid recipient address '${cleanRecipient}'. Must be a valid 40-character hex Ethereum address.`);
  }

  // 3. Amount validation
  const numAmount = typeof input.amountEth === 'number' ? input.amountEth : parseFloat(input.amountEth);
  if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
    throw new Error(`Invalid transfer amount '${input.amountEth}'. Must be a positive finite number.`);
  }

  // 4. Calldata validation
  let cleanCalldata: `0x${string}` = '0x';
  if (input.calldata && input.calldata.trim() !== '') {
    const cd = input.calldata.trim();
    if (!cd.startsWith('0x') || !/^(0x)?[0-9a-fA-F]*$/.test(cd) || cd.length % 2 !== 0) {
      throw new Error('Invalid calldata: Must be a valid even-length hex string starting with 0x.');
    }
    cleanCalldata = cd as `0x${string}`;
  }

  return {
    recipient: cleanRecipient as Address,
    amountEth: numAmount,
    calldata: cleanCalldata,
    chainId: BASE_SEPOLIA_CHAIN_ID,
  };
}

/**
 * Compute tamper-evident binding hash for prepared transaction
 */
export function computePayloadHash(payload: {
  chainId: number;
  from: string;
  to: string;
  amountEth: number;
  calldata: string;
}): string {
  const serialized = JSON.stringify({
    chainId: payload.chainId,
    from: payload.from.toLowerCase(),
    to: payload.to.toLowerCase(),
    amountEth: payload.amountEth,
    calldata: payload.calldata.toLowerCase(),
  });
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Execute Alchemy asset change simulation using exact RPC schema
 */
async function callAlchemySimulate(
  from: Address,
  to: Address,
  valueHex: `0x${string}`,
  calldata: `0x${string}`,
  alchemyUrl: string
): Promise<{
  supported: boolean;
  success: boolean;
  changes: SimulatedAssetChange[];
  gasUsed?: string;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const body = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'alchemy_simulateAssetChanges',
      params: [
        {
          from,
          to,
          value: valueHex,
          data: calldata,
        },
      ],
    };

    const res = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.status === 400 || res.status === 403 || res.status === 404) {
      // Endpoint or method not supported on this app / network tier
      return { supported: false, success: false, changes: [], error: `Alchemy HTTP ${res.status}: Method or network tier unsupported.` };
    }

    const data: any = await res.json().catch(() => null);
    if (!data) {
      return { supported: false, success: false, changes: [], error: 'Malformed JSON response from Alchemy RPC.' };
    }

    if (data.error) {
      const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
      if (errMsg.includes('Unsupported method') || errMsg.includes('not enabled') || data.error.code === -32600 || data.error.code === -32601) {
        return { supported: false, success: false, changes: [], error: errMsg };
      }
      return { supported: true, success: false, changes: [], error: errMsg };
    }

    const result = data.result;
    if (result && Array.isArray(result.changes)) {
      const parsedChanges: SimulatedAssetChange[] = result.changes.map((c: any) => ({
        assetType: c.assetType || 'NATIVE',
        changeType: c.changeType || 'TRANSFER',
        from: c.from,
        to: c.to,
        rawAmount: c.rawAmount || '0',
        amount: c.amount || '0',
        symbol: c.symbol || 'ETH',
        decimals: c.decimals,
        contractAddress: c.contractAddress,
      }));

      return {
        supported: true,
        success: !result.error,
        changes: parsedChanges,
        gasUsed: result.gasUsed ? BigInt(result.gasUsed).toString() : undefined,
        error: result.error ? result.error.message : undefined,
      };
    }

    return { supported: false, success: false, changes: [], error: 'Unexpected response schema from Alchemy simulation.' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { supported: true, success: false, changes: [], error: 'Alchemy simulation query timed out (8s).' };
    }
    return { supported: false, success: false, changes: [], error: err.message };
  }
}

/**
 * Simulate transaction, verify fees, calculate affordability, and evaluate policies
 */
export async function simulateAndPrepareTransaction(
  input: ProposedTransactionInput,
  contextData: {
    agent: BackendAgent;
    policies: BackendSpendingPolicy[];
    isEmergencyPaused: boolean;
  }
): Promise<SimulationResult> {
  // 1. Strict input validation
  const validated = validateProposedTransaction(input);
  const senderAddress = serverAccount.address;
  const valueWei = parseEther(validated.amountEth.toFixed(8));
  const valueHex = `0x${valueWei.toString(16)}` as `0x${string}`;

  // 2. Strict chain ID check against live RPC
  const liveChainId = await publicClient.getChainId().catch(() => {
    throw new Error('RPC unavailable: Failed to connect to Base Sepolia RPC endpoint.');
  });

  if (Number(liveChainId) !== BASE_SEPOLIA_CHAIN_ID) {
    throw new Error(`Chain mismatch: Execution rejected. Connected chain ID ${liveChainId} does not match Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}).`);
  }

  // 3. EIP-1559 Fee Estimation with +20% buffer and 100 Gwei safety cap
  const feeInfo = await estimateFeesWithBuffer(publicClient);

  // 4. Gas Limit Estimation
  let gasLimit = 21000n;
  let evmCallError: string | null = null;

  try {
    const estimatedGas = await publicClient.estimateGas({
      account: senderAddress,
      to: validated.recipient,
      value: valueWei,
      data: validated.calldata,
    });
    // Add 10% safety buffer to gas limit
    gasLimit = (estimatedGas * 110n) / 100n;
    if (gasLimit < 21000n) gasLimit = 21000n;
  } catch (estErr: any) {
    // If standard 21000 native transfer fails estimation (e.g. 0 balance), keep 21000 for standard transfer
    if (validated.calldata === '0x') {
      gasLimit = 21000n;
    } else {
      evmCallError = estErr.message;
    }
  }

  // 5. Test EVM Call simulation (verifies execution without reverting)
  let evmCallSuccess = false;
  if (!evmCallError) {
    try {
      await publicClient.call({
        account: senderAddress,
        to: validated.recipient,
        value: valueWei,
        data: validated.calldata,
      });
      evmCallSuccess = true;
    } catch (callErr: any) {
      evmCallError = callErr.message || 'EVM call reverted';
    }
  }

  // 6. Safe BigInt Fee & Total Cost Arithmetic
  const maxFeeWei = gasLimit * feeInfo.maxFeePerGas;
  const estimatedPriorityFeeWei = feeInfo.maxPriorityFeePerGas;
  const estimatedFeeWei = gasLimit * ((feeInfo.maxFeePerGas + estimatedPriorityFeeWei) / 2n);
  const maxTotalCostWei = valueWei + maxFeeWei;

  // 7. Live Balance & Affordability Check
  const currentBalanceWei = await publicClient.getBalance({ address: senderAddress }).catch(() => 0n);
  const currentBalanceEth = formatEther(currentBalanceWei);
  const sufficientForValue = currentBalanceWei >= valueWei;
  const sufficientForMaxCost = currentBalanceWei >= maxTotalCostWei;

  let shortfallEth: string | undefined = undefined;
  if (!sufficientForMaxCost) {
    const diffWei = maxTotalCostWei - currentBalanceWei;
    shortfallEth = formatEther(diffWei);
  }

  // 8. Attempt Alchemy Simulation (if endpoint/key available)
  let simulationOutcome: 'success' | 'failed' | 'unsupported_provider' | 'timeout' = 'unsupported_provider';
  let simulationProvider: 'alchemy' | 'evm_call' | 'none' = 'none';
  let assetChanges: SimulatedAssetChange[] = [];
  let simulationError: string | undefined = undefined;

  const alchemyUrl = config.alchemyRpcUrl;
  let alchemyAttempted = false;

  if (alchemyUrl) {
    alchemyAttempted = true;
    const alchemyResult = await callAlchemySimulate(
      senderAddress,
      validated.recipient,
      valueHex,
      validated.calldata,
      alchemyUrl
    );

    if (alchemyResult.supported) {
      simulationProvider = 'alchemy';
      if (alchemyResult.success) {
        simulationOutcome = 'success';
        assetChanges = alchemyResult.changes;
      } else {
        simulationOutcome = alchemyResult.error?.includes('timed out') ? 'timeout' : 'failed';
        simulationError = alchemyResult.error;
      }
    }
  }

  // If Alchemy was not supported or not configured, use EVM call simulation
  if (simulationOutcome === 'unsupported_provider') {
    if (evmCallSuccess) {
      simulationProvider = 'evm_call';
      simulationOutcome = 'success';
      // Native asset change synthesis
      assetChanges = [
        {
          assetType: 'NATIVE',
          changeType: 'TRANSFER',
          from: senderAddress,
          to: validated.recipient,
          rawAmount: valueWei.toString(),
          amount: validated.amountEth.toString(),
          symbol: 'ETH',
          decimals: 18,
          contractAddress: null,
        },
      ];
    } else {
      simulationProvider = 'evm_call';
      simulationOutcome = 'failed';
      simulationError = evmCallError || 'EVM simulation call failed.';
    }
  }

  // 9. Evaluate NEXUS Policy Engine
  const proposalForPolicy = {
    task: `Transfer ${validated.amountEth} ETH to ${validated.recipient}`,
    action: 'transfer' as const,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    recipient: validated.recipient,
    token: 'ETH',
    amount: validated.amountEth,
    reason: 'Manual safe transfer through transaction builder',
    confidence: 1,
  };

  const policyResult = evaluateTransactionPolicy({
    agent: contextData.agent,
    policies: contextData.policies,
    proposal: proposalForPolicy,
    isEmergencyPaused: contextData.isEmergencyPaused,
    walletBalanceEth: parseFloat(currentBalanceEth),
  });

  // 10. Generate Warnings
  const warnings: string[] = [
    'Simulation is not a guarantee of future on-chain execution and does not prove the destination contract or recipient is secure.',
  ];

  if (!sufficientForMaxCost) {
    warnings.push(`Signer wallet holds ${currentBalanceEth} ETH, which is insufficient to cover the transfer plus maximum gas fee (${formatEther(maxTotalCostWei)} ETH).`);
  }

  if (simulationProvider !== 'alchemy') {
    warnings.push('Alchemy asset changes simulation endpoint was unavailable on this network tier; fell back to authoritative Base Sepolia EVM call simulation.');
  }

  if (simulationOutcome === 'failed') {
    warnings.push(`Simulation detected failure: ${simulationError || 'Transaction would revert on-chain.'}`);
  }

  // 11. Compute Cryptographic Binding Hash
  const preparedPayloadHash = computePayloadHash({
    chainId: BASE_SEPOLIA_CHAIN_ID,
    from: senderAddress,
    to: validated.recipient,
    amountEth: validated.amountEth,
    calldata: validated.calldata,
  });

  return {
    valid: policyResult.approved && sufficientForMaxCost && simulationOutcome !== 'failed',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    network: 'Base Sepolia',
    sender: senderAddress,
    recipient: validated.recipient,
    amountEth: validated.amountEth,
    calldata: validated.calldata,
    simulation: {
      outcome: simulationOutcome,
      provider: simulationProvider,
      assetChanges,
      gasUsed: gasLimit.toString(),
      rawError: simulationError,
    },
    gas: {
      gasLimit: gasLimit.toString(),
      maxFeePerGasWei: feeInfo.maxFeePerGas.toString(),
      maxPriorityFeePerGasWei: feeInfo.maxPriorityFeePerGas.toString(),
      maxFeePerGasGwei: formatEther(feeInfo.maxFeePerGas * 1_000_000_000n),
      estimatedFeeEth: formatEther(estimatedFeeWei),
      maxFeeEth: formatEther(maxFeeWei),
      maxTotalCostEth: formatEther(maxTotalCostWei),
    },
    affordability: {
      currentBalanceEth,
      currentBalanceWei: currentBalanceWei.toString(),
      sufficientForValue,
      sufficientForMaxCost,
      shortfallEth,
    },
    policyResult,
    warnings,
    preparedPayloadHash,
    timestamp: new Date().toISOString(),
  };
}
