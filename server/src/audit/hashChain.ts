// server/src/audit/hashChain.ts
// Cryptographic Tamper-Evident Hash Chain for Bank-Grade Financial Audit Trail
import crypto from 'crypto';
import type { AuditRecord } from '../types/backend.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface ChainedAuditRecord extends AuditRecord {
  prevHash: string;
  recordHash: string;
  sequenceNumber: number;
}

/**
 * Computes the deterministic SHA-256 cryptographic hash of an audit record linked to the previous block
 */
export function computeRecordHash(prevHash: string, record: Omit<ChainedAuditRecord, 'recordHash'>): string {
  const canonicalPayload = [
    prevHash,
    record.id,
    record.sequenceNumber,
    record.timestamp,
    record.agentId,
    record.agentName,
    record.taskGoal,
    record.outcome,
    record.txHash || 'NONE',
    record.blockNumber != null ? String(record.blockNumber) : 'NONE',
    record.details,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

/**
 * Verifies the integrity of an ordered sequence of chained audit records from genesis to head
 */
export function verifyAuditChainIntegrity(records: ChainedAuditRecord[]): {
  isValid: boolean;
  totalRecords: number;
  headHash: string | null;
  corruptedRecordId?: string;
  error?: string;
} {
  if (records.length === 0) {
    return { isValid: true, totalRecords: 0, headHash: null };
  }

  // Sort ascending by sequence number / timestamp
  const ordered = [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  // If genesis sequence 1 is present, it must start with GENESIS_HASH
  if (ordered[0].sequenceNumber === 1 && ordered[0].prevHash !== GENESIS_HASH) {
    return {
      isValid: false,
      totalRecords: ordered.length,
      headHash: null,
      corruptedRecordId: ordered[0].id,
      error: `Genesis block (seq 1) must anchor to GENESIS_HASH, found ${ordered[0].prevHash.substring(0, 12)}...`,
    };
  }

  let expectedPrevHash = ordered[0].prevHash;

  for (let i = 0; i < ordered.length; i++) {
    const record = ordered[i];

    // 1. Verify previous hash pointer continuity
    if (record.prevHash !== expectedPrevHash) {
      return {
        isValid: false,
        totalRecords: ordered.length,
        headHash: null,
        corruptedRecordId: record.id,
        error: `Broken chain pointer at index ${i} (ID: ${record.id}). Expected prevHash ${expectedPrevHash.substring(0, 12)}..., found ${record.prevHash.substring(0, 12)}...`,
      };
    }

    // 2. Recompute record hash to ensure details were not altered post-hoc
    const expectedHash = computeRecordHash(record.prevHash, record);
    if (record.recordHash !== expectedHash) {
      return {
        isValid: false,
        totalRecords: ordered.length,
        headHash: null,
        corruptedRecordId: record.id,
        error: `Cryptographic digest mismatch at index ${i} (ID: ${record.id}). Record content has been modified after logging!`,
      };
    }

    expectedPrevHash = record.recordHash;
  }

  return {
    isValid: true,
    totalRecords: ordered.length,
    headHash: ordered[ordered.length - 1].recordHash,
  };
}
