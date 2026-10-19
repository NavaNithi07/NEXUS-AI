// server/src/blockchain/reconciliation.ts
// Blockchain Financial Ledger Reconciliation Engine
// Periodically audits internal execution records against authoritative on-chain receipts
import { publicClient, baseSepolia } from './client.js';
import type { ExecutionJobResult } from '../types/backend.js';

export interface ReconciliationReport {
  timestamp: string;
  totalAudited: number;
  matchedCount: number;
  mismatchCount: number;
  unconfirmedCount: number;
  discrepancies: Array<{
    jobId: string;
    txHash: string;
    internalStatus: string;
    onChainStatus: 'success' | 'reverted' | 'not_found' | 'rpc_error';
    internalBlock?: number;
    onChainBlock?: number;
    reconciliationAction: string;
  }>;
}

/**
 * Reconciles internal transactions with authoritative Base Sepolia blockchain state
 */
export async function reconcileTransactions(jobs: ExecutionJobResult[]): Promise<ReconciliationReport> {
  const timestamp = new Date().toISOString();
  const txJobs = jobs.filter((j) => j.txHash && j.txHash.startsWith('0x'));

  const discrepancies: ReconciliationReport['discrepancies'] = [];
  let matchedCount = 0;
  let mismatchCount = 0;
  let unconfirmedCount = 0;

  for (const job of txJobs) {
    const txHash = job.txHash as `0x${string}`;

    try {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        unconfirmedCount++;
        discrepancies.push({
          jobId: job.jobId,
          txHash,
          internalStatus: job.status,
          onChainStatus: 'not_found',
          reconciliationAction: 'Flagged for inspection: Transaction hash not yet mined into block.',
        });
        continue;
      }

      const onChainStatus = receipt.status === 'success' ? 'success' : 'reverted';
      const onChainBlock = Number(receipt.blockNumber);

      // Check for discrepancies between internal status and real on-chain receipt
      if (job.status === 'confirmed' && onChainStatus === 'reverted') {
        mismatchCount++;
        discrepancies.push({
          jobId: job.jobId,
          txHash,
          internalStatus: job.status,
          onChainStatus: 'reverted',
          internalBlock: job.blockNumber,
          onChainBlock,
          reconciliationAction: 'CRITICAL MISMATCH: Transaction was logged as confirmed, but on-chain execution reverted!',
        });
      } else if (job.status === 'confirmed' && onChainStatus === 'success') {
        matchedCount++;
      } else if (job.status !== 'confirmed' && onChainStatus === 'success') {
        mismatchCount++;
        discrepancies.push({
          jobId: job.jobId,
          txHash,
          internalStatus: job.status,
          onChainStatus: 'success',
          onChainBlock,
          reconciliationAction: 'SYNC NOTICE: Transaction succeeded on-chain but was in pending/submitting internal state.',
        });
      }
    } catch (err: any) {
      if (err.name === 'TransactionNotFoundError' || err.message?.includes('could not be found')) {
        unconfirmedCount++;
        discrepancies.push({
          jobId: job.jobId,
          txHash,
          internalStatus: job.status,
          onChainStatus: 'not_found',
          reconciliationAction: 'Transaction receipt not found on Base Sepolia. Possible dropped transaction.',
        });
      } else {
        discrepancies.push({
          jobId: job.jobId,
          txHash,
          internalStatus: job.status,
          onChainStatus: 'rpc_error',
          reconciliationAction: `RPC query error: ${err.message}`,
        });
      }
    }
  }

  return {
    timestamp,
    totalAudited: txJobs.length,
    matchedCount,
    mismatchCount,
    unconfirmedCount,
    discrepancies,
  };
}
