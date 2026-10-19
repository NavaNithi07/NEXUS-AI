// server/src/audit/store.ts
// Persistent state store backed by SQLite via better-sqlite3
import crypto from 'crypto';
import { getDb } from '../db/database.js';
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

function parseAgent(row: any): BackendAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    status: row.status,
    balance: row.balance,
    dailyLimit: row.daily_limit,
    maxTxAmount: row.max_tx_amount,
    spentToday: row.spent_today,
    txCount: row.tx_count,
    createdAt: row.created_at,
    lastActive: row.last_active,
    avatarIcon: row.avatar_icon,
    allowedRecipients: JSON.parse(row.allowed_recipients || '[]'),
    allowedTokens: JSON.parse(row.allowed_tokens || '["ETH","USDC"]'),
  };
}

function parsePolicy(row: any): BackendSpendingPolicy {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetAgent: row.target_agent,
    maxDailySpend: row.max_daily_spend,
    maxSingleTx: row.max_single_tx,
    requireApprovalAbove: row.require_approval_above,
    allowedTokens: JSON.parse(row.allowed_tokens || '["ETH","USDC"]'),
    status: row.status,
  };
}

// === Emergency Status ===

export function getEmergencyStatus(): boolean {
  const db = getDb();
  const row = db.prepare("SELECT value FROM system_state WHERE key = 'emergency_paused'").get() as any;
  return row?.value === 'true';
}

export function setEmergencyStatus(paused: boolean): void {
  const db = getDb();
  db.prepare("UPDATE system_state SET value = ?, updated_at = datetime('now') WHERE key = 'emergency_paused'")
    .run(paused ? 'true' : 'false');
  addAuditRecord({
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

// === Agents ===

export function getAgents(): BackendAgent[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as any[]).map(parseAgent);
}

export function getAgent(id: string): BackendAgent | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
  return row ? parseAgent(row) : undefined;
}

export function addAgent(agent: BackendAgent): BackendAgent {
  const db = getDb();
  db.prepare(`
    INSERT INTO agents (id, name, description, type, status, balance, daily_limit, max_tx_amount,
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

export function updateAgent(id: string, updates: Partial<BackendAgent>): BackendAgent | undefined {
  const db = getDb();
  const current = getAgent(id);
  if (!current) return undefined;

  const merged = { ...current, ...updates };
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

export function deleteAgent(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  return result.changes > 0;
}

// === Policies ===

export function getPolicies(): BackendSpendingPolicy[] {
  const db = getDb();
  return (db.prepare('SELECT * FROM policies ORDER BY id').all() as any[]).map(parsePolicy);
}

export function addPolicy(policy: BackendSpendingPolicy): BackendSpendingPolicy {
  const db = getDb();
  db.prepare(`
    INSERT INTO policies (id, name, description, target_agent, max_daily_spend,
      max_single_tx, require_approval_above, allowed_tokens, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    policy.id, policy.name, policy.description, policy.targetAgent,
    policy.maxDailySpend, policy.maxSingleTx, policy.requireApprovalAbove,
    JSON.stringify(policy.allowedTokens), policy.status,
  );
  return policy;
}

export function updatePolicy(id: string, updates: Partial<BackendSpendingPolicy>): BackendSpendingPolicy | undefined {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM policies WHERE id = ?').get(id) as any;
  if (!existing) return undefined;
  const current = parsePolicy(existing);
  const merged = { ...current, ...updates };
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

export function deletePolicy(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM policies WHERE id = ?').run(id);
  return result.changes > 0;
}

// === Audit Records ===

export function addAuditRecord(record: AuditRecord): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO audit_records
      (id, timestamp, agent_id, agent_name, task_goal, proposal, policy_check,
       outcome, tx_hash, explorer_url, block_number, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id, record.timestamp, record.agentId, record.agentName,
    record.taskGoal, JSON.stringify(record.proposal), JSON.stringify(record.policyCheck),
    record.outcome, record.txHash ?? null, record.explorerUrl ?? null,
    record.blockNumber ?? null, record.details,
  );
}

export function getAuditRecords(): AuditRecord[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM audit_records ORDER BY timestamp DESC LIMIT 500').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    agentId: r.agent_id,
    agentName: r.agent_name,
    taskGoal: r.task_goal,
    proposal: JSON.parse(r.proposal),
    policyCheck: JSON.parse(r.policy_check),
    outcome: r.outcome,
    txHash: r.tx_hash,
    explorerUrl: r.explorer_url,
    blockNumber: r.block_number,
    details: r.details,
  }));
}

// === Execution Jobs & Idempotency ===

function parseExecutionJob(r: any): ExecutionJobResult {
  return {
    jobId: r.job_id,
    taskId: r.task_id,
    agentId: r.agent_id,
    agentName: r.agent_name,
    proposal: JSON.parse(r.proposal),
    policyResult: JSON.parse(r.policy_result),
    status: r.status,
    txHash: r.tx_hash,
    explorerUrl: r.explorer_url,
    blockNumber: r.block_number,
    gasUsed: r.gas_used,
    effectiveGasPrice: r.effective_gas_price,
    executedAt: r.executed_at,
    error: r.error,
  };
}

export function addExecutionJob(job: ExecutionJobResult, idempotencyKey?: string, payloadHash?: string): void {
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

export function getExecutionJobs(): ExecutionJobResult[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM execution_jobs ORDER BY executed_at DESC LIMIT 200').all() as any[];
  return rows.map(parseExecutionJob);
}

export function getExecutionJobById(jobId: string): ExecutionJobResult | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM execution_jobs WHERE job_id = ?').get(jobId) as any;
  return row ? parseExecutionJob(row) : undefined;
}

export function getExecutionJobByIdempotencyKey(key: string): ExecutionJobResult | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM execution_jobs WHERE idempotency_key = ?').get(key) as any;
  return row ? parseExecutionJob(row) : undefined;
}

/**
 * Concurrency-safe idempotency key reservation:
 * Uses a SQLite transaction to atomically reserve a key or detect conflicts / completed states.
 */
export function reserveIdempotencyKey(key: string, payloadHash: string): {
  status: 'reserved' | 'conflict' | 'completed' | 'in_flight';
  job?: ExecutionJobResult;
  existingPayloadHash?: string;
} {
  const db = getDb();
  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM idempotency_records WHERE key = ?').get(key) as any;
    if (existing) {
      if (existing.payload_hash !== payloadHash) {
        return {
          status: 'conflict' as const,
          existingPayloadHash: existing.payload_hash,
        };
      }
      if (existing.status === 'completed' || existing.status === 'rejected') {
        const job = existing.job_id
          ? getExecutionJobById(existing.job_id) || getExecutionJobByIdempotencyKey(key)
          : getExecutionJobByIdempotencyKey(key);
        return {
          status: 'completed' as const,
          job,
        };
      }
      return {
        status: 'in_flight' as const,
      };
    }

    // Insert new reservation atomically
    db.prepare(`
      INSERT INTO idempotency_records (key, payload_hash, status, created_at)
      VALUES (?, ?, 'in_flight', datetime('now'))
    `).run(key, payloadHash);

    return { status: 'reserved' as const };
  });

  return tx();
}

/**
 * Mark idempotency reservation as completed with job outcome
 */
export function completeIdempotencyKey(key: string, jobId: string, status: 'completed' | 'rejected'): void {
  const db = getDb();
  db.prepare(`
    UPDATE idempotency_records
    SET status = ?, job_id = ?, completed_at = datetime('now')
    WHERE key = ?
  `).run(status, jobId, key);
}

/**
 * Release in-flight reservation on unhandled exception
 */
export function releaseIdempotencyKey(key: string): void {
  const db = getDb();
  db.prepare("DELETE FROM idempotency_records WHERE key = ? AND status = 'in_flight'").run(key);
}

// === Concurrency-safe atomic daily spending update ===
// Returns the new spentToday value, or throws if would exceed the limit
export function atomicSpendingUpdate(
  agentId: string,
  amount: number,
  dailyLimit: number
): number {
  const db = getDb();
  const updateWithCheck = db.transaction(() => {
    const agent = db.prepare('SELECT spent_today FROM agents WHERE id = ?').get(agentId) as any;
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    const newSpent = agent.spent_today + amount;
    if (newSpent > dailyLimit) {
      throw new Error(
        `Atomic daily limit check: ${newSpent.toFixed(6)} would exceed limit of ${dailyLimit}`
      );
    }
    db.prepare('UPDATE agents SET spent_today = ?, tx_count = tx_count + 1, last_active = ? WHERE id = ?')
      .run(newSpent, 'Just now', agentId);
    return newSpent;
  });
  return updateWithCheck();
}

// Legacy compatibility shim — wraps the flat functions as a class-like object
export const db = {
  getEmergencyStatus,
  setEmergencyStatus,
  getAgents,
  getAgent,
  addAgent,
  updateAgent,
  deleteAgent,
  getPolicies,
  addPolicy,
  updatePolicy,
  deletePolicy,
  addAuditRecord,
  getAuditRecords,
  addExecutionJob,
  getExecutionJobs,
  getExecutionJobById,
  getExecutionJobByIdempotencyKey,
  createCanonicalPayloadHash,
  reserveIdempotencyKey,
  completeIdempotencyKey,
  releaseIdempotencyKey,
  atomicSpendingUpdate,
};

export default db;
