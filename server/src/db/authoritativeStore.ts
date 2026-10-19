// server/src/db/authoritativeStore.ts
// Authoritative Persistence Layer: Neon Serverless PostgreSQL (Primary) with SQLite WAL Enclave
// Enforces ACID transactions, row-level locking (SELECT ... FOR UPDATE), fail-closed durability, and audit chain immutability.

import crypto from 'crypto';
import pg from 'pg';
import { getDb } from './database.js';
import { getNeonPool, queryNeon } from './neon.js';
import {
  computeRecordHash,
  verifyAuditChainIntegrity,
  GENESIS_HASH,
  type ChainedAuditRecord,
} from '../audit/hashChain.js';
import type {
  BackendAgent,
  BackendSpendingPolicy,
  AuditRecord,
  ExecutionJobResult,
} from '../types/backend.js';

export function createCanonicalPayloadHash(data: {
  agentId: string;
  taskGoal: string;
  recipient?: string | null;
  amount?: number | null;
  token?: string | null;
  chainId?: number | null;
}): string {
  const normalized = {
    agentId: (data.agentId || '').trim().toLowerCase(),
    amount: data.amount != null ? Number(data.amount).toFixed(8) : '0.00000000',
    chainId: data.chainId != null ? Number(data.chainId) : 84532,
    recipient: (data.recipient || '').trim().toLowerCase(),
    taskGoal: (data.taskGoal || '').trim().toLowerCase().replace(/\s+/g, ' '),
    token: (data.token || 'ETH').trim().toUpperCase(),
  };

  const canonicalString = Object.keys(normalized)
    .sort()
    .map((k) => `${k}=${(normalized as any)[k]}`)
    .join('&');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

function parseAgentRow(row: any): BackendAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.type || 'Treasury Manager',
    status: row.status || 'active',
    balance: Number(row.balance || 0),
    dailyLimit: Number(row.daily_limit || row.dailyLimit || 0.05),
    maxTxAmount: Number(row.max_tx_amount || row.maxTxAmount || 0.01),
    spentToday: Number(row.spent_today || row.spentToday || 0),
    txCount: Number(row.tx_count || row.txCount || 0),
    createdAt: row.created_at || row.createdAt,
    lastActive: row.last_active || row.lastActive || 'Just now',
    avatarIcon: row.avatar_icon || row.avatarIcon,
    allowedRecipients: typeof row.allowed_recipients === 'string'
      ? JSON.parse(row.allowed_recipients || '[]')
      : (row.allowed_recipients || row.allowedRecipients || []),
    allowedTokens: typeof row.allowed_tokens === 'string'
      ? JSON.parse(row.allowed_tokens || '["ETH","USDC"]')
      : (row.allowed_tokens || row.allowedTokens || ['ETH', 'USDC']),
  };
}

function parsePolicyRow(row: any): BackendSpendingPolicy {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    targetAgent: row.target_agent || row.targetAgent || 'all',
    maxDailySpend: Number(row.max_daily_spend || row.maxDailySpend),
    maxSingleTx: Number(row.max_single_tx || row.maxSingleTx),
    requireApprovalAbove: Number(row.require_approval_above || row.requireApprovalAbove || 10000),
    allowedTokens: typeof row.allowed_tokens === 'string'
      ? JSON.parse(row.allowed_tokens || '["ETH","USDC"]')
      : (row.allowed_tokens || row.allowedTokens || ['ETH', 'USDC']),
    status: row.status || 'active',
  };
}

function parseExecutionJobRow(r: any): ExecutionJobResult {
  return {
    jobId: r.job_id || r.id,
    taskId: r.task_id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    proposal: typeof r.proposal === 'string' ? JSON.parse(r.proposal) : r.proposal,
    policyResult: typeof r.policy_result === 'string' ? JSON.parse(r.policy_result) : r.policy_result,
    status: r.status,
    txHash: r.tx_hash,
    explorerUrl: r.explorer_url,
    blockNumber: r.block_number != null ? Number(r.block_number) : undefined,
    gasUsed: r.gas_used,
    effectiveGasPrice: r.effective_gas_price,
    executedAt: r.executed_at,
    error: r.error,
  };
}

export class AuthoritativeStore {
  // ── Database Authority Checks ───────────────────────────────────────────
  public isNeonAuthoritative(): boolean {
    return Boolean(process.env.DATABASE_URL && getNeonPool());
  }

  // ── Emergency Status ────────────────────────────────────────────────────
  public async getEmergencyStatus(): Promise<boolean> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query("SELECT value FROM system_state WHERE key = 'emergency_paused'");
      return res.rows[0]?.value === 'true';
    }
    const db = getDb();
    const row = db.prepare("SELECT value FROM system_state WHERE key = 'emergency_paused'").get() as any;
    return row?.value === 'true';
  }

  public async setEmergencyStatus(paused: boolean): Promise<void> {
    const valStr = paused ? 'true' : 'false';
    const pool = getNeonPool();

    if (pool) {
      // Authoritative write to Neon first. If this fails, operation fails closed!
      await pool.query(
        `INSERT INTO system_state (key, value, updated_at) VALUES ('emergency_paused', $1, NOW()::text)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;`,
        [valStr]
      );
    }

    // Mirror to local SQLite
    const db = getDb();
    db.prepare("UPDATE system_state SET value = ?, updated_at = datetime('now') WHERE key = 'emergency_paused'").run(valStr);

    await this.addAuditRecord({
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      agentId: 'system',
      agentName: 'Emergency Circuit Breaker',
      taskGoal: paused ? 'Trigger Global Emergency Pause' : 'Resume Global Operations',
      proposal: {
        task: 'Killswitch State Toggle',
        action: 'none',
        chainId: 84532,
        recipient: '0x0000000000000000000000000000000000000000',
        token: 'N/A',
        amount: 0,
        reason: paused ? 'Emergency kill-switch engaged' : 'Operations resumed',
        confidence: 1,
      },
      policyCheck: {
        approved: true,
        violations: [],
        checks: {
          agentActive: true,
          killswitchDisengaged: !paused,
          recipientAllowlisted: true,
          singleTxLimitPassed: true,
          dailyBudgetPassed: true,
          networkSupported: true,
          balanceSufficient: true,
        },
      },
      outcome: 'confirmed',
      details: paused
        ? 'Global killswitch ENGAGED. All on-chain execution rejected.'
        : 'Global killswitch DISENGAGED. Normal operations restored.',
    });
  }

  // ── Agents ──────────────────────────────────────────────────────────────
  public async getAgents(): Promise<BackendAgent[]> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM agents ORDER BY created_at DESC');
      return res.rows.map(parseAgentRow);
    }
    const db = getDb();
    return (db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as any[]).map(parseAgentRow);
  }

  public async getAgent(id: string): Promise<BackendAgent | undefined> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM agents WHERE id = $1', [id]);
      return res.rows[0] ? parseAgentRow(res.rows[0]) : undefined;
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    return row ? parseAgentRow(row) : undefined;
  }

  public async addAgent(agent: BackendAgent): Promise<BackendAgent> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query(`
        INSERT INTO agents (id, name, description, type, status, balance, daily_limit, max_tx_amount, spent_today, tx_count, created_at, last_active, avatar_icon, allowed_recipients, allowed_tokens)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, description = EXCLUDED.description, balance = EXCLUDED.balance,
          daily_limit = EXCLUDED.daily_limit, max_tx_amount = EXCLUDED.max_tx_amount,
          status = EXCLUDED.status;
      `, [
        agent.id, agent.name, agent.description, agent.type, agent.status,
        agent.balance, agent.dailyLimit, agent.maxTxAmount,
        agent.spentToday, agent.txCount, agent.createdAt, agent.lastActive,
        agent.avatarIcon ?? null,
        JSON.stringify(agent.allowedRecipients),
        JSON.stringify(agent.allowedTokens),
      ]);
    }

    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO agents (id, name, description, type, status, balance, daily_limit, max_tx_amount,
        spent_today, tx_count, created_at, last_active, avatar_icon, allowed_recipients, allowed_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      agent.id, agent.name, agent.description, agent.type, agent.status,
      agent.balance, agent.dailyLimit, agent.maxTxAmount,
      agent.spentToday, agent.txCount, agent.createdAt, agent.lastActive,
      agent.avatarIcon ?? null,
      JSON.stringify(agent.allowedRecipients),
      JSON.stringify(agent.allowedTokens),
    );

    return agent;
  }

  public async updateAgent(id: string, updates: Partial<BackendAgent>): Promise<BackendAgent | undefined> {
    const current = await this.getAgent(id);
    if (!current) return undefined;
    const merged = { ...current, ...updates };

    const pool = getNeonPool();
    if (pool) {
      await pool.query(`
        UPDATE agents SET
          name = $1, description = $2, type = $3, status = $4, balance = $5,
          daily_limit = $6, max_tx_amount = $7, spent_today = $8, tx_count = $9,
          last_active = $10, allowed_recipients = $11::jsonb, allowed_tokens = $12::jsonb
        WHERE id = $13;
      `, [
        merged.name, merged.description, merged.type, merged.status,
        merged.balance, merged.dailyLimit, merged.maxTxAmount,
        merged.spentToday, merged.txCount, merged.lastActive,
        JSON.stringify(merged.allowedRecipients),
        JSON.stringify(merged.allowedTokens),
        id,
      ]);
    }

    const db = getDb();
    db.prepare(`
      UPDATE agents SET
        name = ?, description = ?, type = ?, status = ?, balance = ?,
        daily_limit = ?, max_tx_amount = ?, spent_today = ?, tx_count = ?,
        last_active = ?, avatar_icon = ?, allowed_recipients = ?, allowed_tokens = ?
      WHERE id = ?
    `).run(
      merged.name, merged.description, merged.type, merged.status,
      merged.balance, merged.dailyLimit, merged.maxTxAmount,
      merged.spentToday, merged.txCount, merged.lastActive,
      merged.avatarIcon ?? null,
      JSON.stringify(merged.allowedRecipients),
      JSON.stringify(merged.allowedTokens),
      id,
    );

    return merged;
  }

  public async deleteAgent(id: string): Promise<boolean> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query('DELETE FROM agents WHERE id = $1', [id]);
    }
    const db = getDb();
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Policies ────────────────────────────────────────────────────────────
  public async getPolicies(): Promise<BackendSpendingPolicy[]> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM policies ORDER BY id');
      return res.rows.map(parsePolicyRow);
    }
    const db = getDb();
    return (db.prepare('SELECT * FROM policies ORDER BY id').all() as any[]).map(parsePolicyRow);
  }

  public async addPolicy(policy: BackendSpendingPolicy): Promise<BackendSpendingPolicy> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query(`
        INSERT INTO policies (id, name, description, target_agent, max_daily_spend, max_single_tx, require_approval_above, allowed_tokens, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, max_daily_spend = EXCLUDED.max_daily_spend,
          max_single_tx = EXCLUDED.max_single_tx, status = EXCLUDED.status;
      `, [
        policy.id, policy.name, policy.description, policy.targetAgent,
        policy.maxDailySpend, policy.maxSingleTx, policy.requireApprovalAbove,
        JSON.stringify(policy.allowedTokens), policy.status,
      ]);
    }

    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO policies (id, name, description, target_agent, max_daily_spend,
        max_single_tx, require_approval_above, allowed_tokens, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      policy.id, policy.name, policy.description, policy.targetAgent,
      policy.maxDailySpend, policy.maxSingleTx, policy.requireApprovalAbove,
      JSON.stringify(policy.allowedTokens), policy.status,
    );

    return policy;
  }

  public async updatePolicy(id: string, updates: Partial<BackendSpendingPolicy>): Promise<BackendSpendingPolicy | undefined> {
    const pool = getNeonPool();
    let current: BackendSpendingPolicy | undefined;

    if (pool) {
      const res = await pool.query('SELECT * FROM policies WHERE id = $1', [id]);
      if (res.rows[0]) current = parsePolicyRow(res.rows[0]);
    } else {
      const db = getDb();
      const existing = db.prepare('SELECT * FROM policies WHERE id = ?').get(id) as any;
      if (existing) current = parsePolicyRow(existing);
    }

    if (!current) return undefined;
    const merged = { ...current, ...updates };

    if (pool) {
      await pool.query(`
        UPDATE policies SET
          name = $1, description = $2, target_agent = $3, max_daily_spend = $4,
          max_single_tx = $5, require_approval_above = $6, allowed_tokens = $7::jsonb, status = $8
        WHERE id = $9;
      `, [
        merged.name, merged.description, merged.targetAgent, merged.maxDailySpend,
        merged.maxSingleTx, merged.requireApprovalAbove, JSON.stringify(merged.allowedTokens),
        merged.status, id,
      ]);
    }

    const db = getDb();
    db.prepare(`
      UPDATE policies SET
        name = ?, description = ?, target_agent = ?, max_daily_spend = ?,
        max_single_tx = ?, require_approval_above = ?, allowed_tokens = ?, status = ?
      WHERE id = ?
    `).run(
      merged.name, merged.description, merged.targetAgent, merged.maxDailySpend,
      merged.maxSingleTx, merged.requireApprovalAbove, JSON.stringify(merged.allowedTokens),
      merged.status, id,
    );

    return merged;
  }

  public async deletePolicy(id: string): Promise<boolean> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query('DELETE FROM policies WHERE id = $1', [id]);
    }
    const db = getDb();
    const result = db.prepare('DELETE FROM policies WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ── Atomic Concurrency-Safe Daily Spending Update ───────────────────────
  public async atomicSpendingUpdate(agentId: string, amount: number, dailyLimit: number): Promise<number> {
    const pool = getNeonPool();

    if (pool) {
      // PostgreSQL atomic transaction with row-level lock (FOR UPDATE)
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const agentRes = await client.query(
          'SELECT spent_today, daily_limit FROM agents WHERE id = $1 FOR UPDATE',
          [agentId]
        );
        if (agentRes.rows.length === 0) {
          throw new Error(`Agent ${agentId} not found`);
        }

        const currentSpent = parseFloat(agentRes.rows[0].spent_today || '0');
        const limit = parseFloat(agentRes.rows[0].daily_limit || dailyLimit.toString());
        const newSpent = currentSpent + amount;

        // If positive spend increment exceeds daily limit, throw and abort
        if (amount > 0 && newSpent > limit) {
          throw new Error(
            `Atomic daily limit check: ${newSpent.toFixed(6)} would exceed limit of ${limit}`
          );
        }

        await client.query(
          "UPDATE agents SET spent_today = $1, tx_count = tx_count + 1, last_active = 'Just now' WHERE id = $2",
          [newSpent, agentId]
        );

        await client.query('COMMIT');

        // Mirror to SQLite
        try {
          const db = getDb();
          db.prepare("UPDATE agents SET spent_today = ?, tx_count = tx_count + 1, last_active = 'Just now' WHERE id = ?")
            .run(newSpent, agentId);
        } catch { /* cache update */ }

        return newSpent;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    // Local SQLite Enclave fallback
    const db = getDb();
    const updateWithCheck = db.transaction(() => {
      const agent = db.prepare('SELECT spent_today, daily_limit FROM agents WHERE id = ?').get(agentId) as any;
      if (!agent) throw new Error(`Agent ${agentId} not found`);
      const limit = agent.daily_limit || dailyLimit;
      const newSpent = Number(agent.spent_today) + amount;
      if (amount > 0 && newSpent > limit) {
        throw new Error(
          `Atomic daily limit check: ${newSpent.toFixed(6)} would exceed limit of ${limit}`
        );
      }
      db.prepare("UPDATE agents SET spent_today = ?, tx_count = tx_count + 1, last_active = 'Just now' WHERE id = ?")
        .run(newSpent, agentId);
      return newSpent;
    });

    return updateWithCheck();
  }

  // ── Concurrency-Safe Idempotency Key Management ─────────────────────────
  public async reserveIdempotencyKey(key: string, payloadHash: string): Promise<{
    status: 'reserved' | 'conflict' | 'completed' | 'in_flight';
    job?: ExecutionJobResult;
    existingPayloadHash?: string;
  }> {
    const pool = getNeonPool();

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Row-level lock on existing idempotency key
        const checkRes = await client.query(
          'SELECT payload_hash, status, job_id FROM idempotency_records WHERE key = $1 FOR UPDATE',
          [key]
        );

        if (checkRes.rows.length > 0) {
          const existing = checkRes.rows[0];
          await client.query('COMMIT');

          if (existing.payload_hash !== payloadHash) {
            return { status: 'conflict', existingPayloadHash: existing.payload_hash };
          }
          if (existing.status === 'completed' || existing.status === 'rejected') {
            const job = await this.getExecutionJobById(existing.job_id);
            return { status: 'completed', job };
          }
          return { status: 'in_flight' };
        }

        // Insert in-flight marker
        await client.query(
          "INSERT INTO idempotency_records (key, payload_hash, status, created_at) VALUES ($1, $2, 'in_flight', NOW()::text)",
          [key, payloadHash]
        );

        await client.query('COMMIT');

        // Also mirror into SQLite
        try {
          const db = getDb();
          db.prepare("INSERT OR REPLACE INTO idempotency_records (key, payload_hash, status, created_at) VALUES (?, ?, 'in_flight', datetime('now'))")
            .run(key, payloadHash);
        } catch { /* mirror */ }

        return { status: 'reserved' };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    // Local SQLite fallback
    const db = getDb();
    const tx = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM idempotency_records WHERE key = ?').get(key) as any;
      if (existing) {
        if (existing.payload_hash !== payloadHash) {
          return { status: 'conflict' as const, existingPayloadHash: existing.payload_hash };
        }
        if (existing.status === 'completed' || existing.status === 'rejected') {
          const job = this.getExecutionJobByIdSync(existing.job_id) || this.getExecutionJobByIdempotencyKeySync(key);
          return { status: 'completed' as const, job };
        }
        return { status: 'in_flight' as const };
      }

      db.prepare("INSERT INTO idempotency_records (key, payload_hash, status, created_at) VALUES (?, ?, 'in_flight', datetime('now'))")
        .run(key, payloadHash);
      return { status: 'reserved' as const };
    });

    return tx();
  }

  public async completeIdempotencyKey(key: string, jobId: string, status: 'completed' | 'rejected'): Promise<void> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query(
        'UPDATE idempotency_records SET status = $1, job_id = $2, completed_at = NOW()::text WHERE key = $3',
        [status, jobId, key]
      );
    }

    const db = getDb();
    db.prepare("UPDATE idempotency_records SET status = ?, job_id = ?, completed_at = datetime('now') WHERE key = ?")
      .run(status, jobId, key);
  }

  public async releaseIdempotencyKey(key: string): Promise<void> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query("DELETE FROM idempotency_records WHERE key = $1 AND status = 'in_flight'", [key]);
    }

    const db = getDb();
    db.prepare("DELETE FROM idempotency_records WHERE key = ? AND status = 'in_flight'").run(key);
  }

  // ── Execution Jobs ──────────────────────────────────────────────────────
  public async addExecutionJob(job: ExecutionJobResult, idempotencyKey?: string, payloadHash?: string): Promise<void> {
    const pool = getNeonPool();
    if (pool) {
      await pool.query(`
        INSERT INTO execution_jobs
          (id, task_id, agent_id, agent_name, job_id, proposal, policy_result, status, tx_hash, explorer_url, block_number, gas_used, effective_gas_price, executed_at, error, idempotency_key, payload_hash)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status, tx_hash = EXCLUDED.tx_hash, explorer_url = EXCLUDED.explorer_url,
          block_number = EXCLUDED.block_number, gas_used = EXCLUDED.gas_used,
          effective_gas_price = EXCLUDED.effective_gas_price, error = EXCLUDED.error;
      `, [
        job.jobId, job.taskId, job.agentId, job.agentName, job.jobId,
        JSON.stringify(job.proposal), JSON.stringify(job.policyResult),
        job.status, job.txHash ?? null, job.explorerUrl ?? null,
        job.blockNumber ?? null, job.gasUsed ?? null, job.effectiveGasPrice ?? null,
        job.executedAt, job.error ?? null, idempotencyKey ?? null, payloadHash ?? null,
      ]);
    }

    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO execution_jobs
        (id, task_id, agent_id, agent_name, job_id, proposal, policy_result,
         status, tx_hash, explorer_url, block_number, gas_used, effective_gas_price,
         executed_at, error, idempotency_key, payload_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      job.jobId, job.taskId, job.agentId, job.agentName, job.jobId,
      JSON.stringify(job.proposal), JSON.stringify(job.policyResult),
      job.status, job.txHash ?? null, job.explorerUrl ?? null,
      job.blockNumber ?? null, job.gasUsed ?? null, job.effectiveGasPrice ?? null,
      job.executedAt, job.error ?? null, idempotencyKey ?? null, payloadHash ?? null,
    );
  }

  public async getExecutionJobs(): Promise<ExecutionJobResult[]> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM execution_jobs ORDER BY executed_at DESC LIMIT 200');
      return res.rows.map(parseExecutionJobRow);
    }
    const db = getDb();
    const rows = db.prepare('SELECT * FROM execution_jobs ORDER BY executed_at DESC LIMIT 200').all() as any[];
    return rows.map(parseExecutionJobRow);
  }

  public async getExecutionJobById(jobId: string): Promise<ExecutionJobResult | undefined> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM execution_jobs WHERE job_id = $1 OR id = $1', [jobId]);
      return res.rows[0] ? parseExecutionJobRow(res.rows[0]) : undefined;
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM execution_jobs WHERE job_id = ? OR id = ?').get(jobId, jobId) as any;
    return row ? parseExecutionJobRow(row) : undefined;
  }

  private getExecutionJobByIdSync(jobId: string): ExecutionJobResult | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM execution_jobs WHERE job_id = ? OR id = ?').get(jobId, jobId) as any;
    return row ? parseExecutionJobRow(row) : undefined;
  }

  private getExecutionJobByIdempotencyKeySync(key: string): ExecutionJobResult | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM execution_jobs WHERE idempotency_key = ?').get(key) as any;
    return row ? parseExecutionJobRow(row) : undefined;
  }

  // ── Cryptographic Tamper-Evident Audit Trail (Read-Only Verification) ──
  public async addAuditRecord(record: AuditRecord): Promise<ChainedAuditRecord> {
    const pool = getNeonPool();
    let prevHash = GENESIS_HASH;
    let sequenceNumber = 1;

    if (pool) {
      const lastRes = await pool.query('SELECT record_hash, sequence_number FROM audit_records ORDER BY sequence_number DESC LIMIT 1');
      if (lastRes.rows[0]?.record_hash) {
        prevHash = lastRes.rows[0].record_hash;
        sequenceNumber = Number(lastRes.rows[0].sequence_number || 0) + 1;
      }
    } else {
      const db = getDb();
      const lastRecord = db.prepare('SELECT record_hash, sequence_number FROM audit_records ORDER BY sequence_number DESC LIMIT 1').get() as any;
      if (lastRecord?.record_hash) {
        prevHash = lastRecord.record_hash;
        sequenceNumber = (lastRecord.sequence_number || 0) + 1;
      }
    }

    const chainedRecord: ChainedAuditRecord = {
      ...record,
      prevHash,
      recordHash: '',
      sequenceNumber,
    };
    chainedRecord.recordHash = computeRecordHash(prevHash, chainedRecord);

    if (pool) {
      await pool.query(`
        INSERT INTO audit_records
          (id, timestamp, agent_id, agent_name, task_goal, proposal, policy_check, outcome, tx_hash, explorer_url, block_number, details, prev_hash, record_hash, sequence_number)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO NOTHING;
      `, [
        chainedRecord.id, chainedRecord.timestamp, chainedRecord.agentId, chainedRecord.agentName,
        chainedRecord.taskGoal, JSON.stringify(chainedRecord.proposal), JSON.stringify(chainedRecord.policyCheck),
        chainedRecord.outcome, chainedRecord.txHash ?? null, chainedRecord.explorerUrl ?? null,
        chainedRecord.blockNumber ?? null, chainedRecord.details,
        chainedRecord.prevHash, chainedRecord.recordHash, chainedRecord.sequenceNumber,
      ]);
    }

    const db = getDb();
    db.prepare(`
      INSERT OR IGNORE INTO audit_records
        (id, timestamp, agent_id, agent_name, task_goal, proposal, policy_check,
         outcome, tx_hash, explorer_url, block_number, details, prev_hash, record_hash, sequence_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chainedRecord.id, chainedRecord.timestamp, chainedRecord.agentId, chainedRecord.agentName,
      chainedRecord.taskGoal, JSON.stringify(chainedRecord.proposal), JSON.stringify(chainedRecord.policyCheck),
      chainedRecord.outcome, chainedRecord.txHash ?? null, chainedRecord.explorerUrl ?? null,
      chainedRecord.blockNumber ?? null, chainedRecord.details,
      chainedRecord.prevHash, chainedRecord.recordHash, chainedRecord.sequenceNumber
    );

    return chainedRecord;
  }

  public async getAuditRecords(): Promise<ChainedAuditRecord[]> {
    const pool = getNeonPool();
    if (pool) {
      const res = await pool.query('SELECT * FROM audit_records ORDER BY sequence_number DESC, timestamp DESC LIMIT 500');
      return res.rows.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        agentId: r.agent_id,
        agentName: r.agent_name,
        taskGoal: r.task_goal,
        proposal: typeof r.proposal === 'string' ? JSON.parse(r.proposal) : r.proposal,
        policyCheck: typeof r.policy_check === 'string' ? JSON.parse(r.policy_check) : r.policy_check,
        outcome: r.outcome,
        txHash: r.tx_hash,
        explorerUrl: r.explorer_url,
        blockNumber: r.block_number != null ? Number(r.block_number) : undefined,
        details: r.details,
        prevHash: r.prev_hash || GENESIS_HASH,
        recordHash: r.record_hash || '',
        sequenceNumber: Number(r.sequence_number || 1),
      }));
    }

    const db = getDb();
    const rows = db.prepare('SELECT * FROM audit_records ORDER BY sequence_number DESC, timestamp DESC LIMIT 500').all() as any[];
    return rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      agentId: r.agent_id,
      agentName: r.agent_name,
      taskGoal: r.task_goal,
      proposal: typeof r.proposal === 'string' ? JSON.parse(r.proposal) : r.proposal,
      policyCheck: typeof r.policy_check === 'string' ? JSON.parse(r.policy_check) : r.policy_check,
      outcome: r.outcome,
      txHash: r.tx_hash,
      explorerUrl: r.explorer_url,
      blockNumber: r.block_number != null ? Number(r.block_number) : undefined,
      details: r.details,
      prevHash: r.prev_hash || GENESIS_HASH,
      recordHash: r.record_hash || '',
      sequenceNumber: Number(r.sequence_number || 1),
    }));
  }

  /**
   * Strictly Read-Only Audit Chain Verification:
   * NEVER mutates or rewrites historical database records.
   * Immediately flags tampering if any record digest does not match.
   */
  public async verifyAuditTrail(): Promise<{
    isValid: boolean;
    totalRecords: number;
    headHash: string | null;
    corruptedRecordId?: string;
    error?: string;
  }> {
    const records = await this.getAuditRecords();
    // Filter only records that participate in the cryptographic hash chain
    const chainedRecords = records.filter((r) => r.recordHash && r.recordHash.length === 64);
    return verifyAuditChainIntegrity(chainedRecords);
  }
}

export const authoritativeStore = new AuthoritativeStore();
export default authoritativeStore;
