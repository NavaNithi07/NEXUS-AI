// server/src/db/neon.ts
// Neon Serverless PostgreSQL Database Integration
import pg from 'pg';
import { getDb } from './database.js';

const { Pool } = pg;

let _neonPool: pg.Pool | null = null;

export function getNeonPool(): pg.Pool | null {
  if (_neonPool) return _neonPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  _neonPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return _neonPool;
}

export async function initializeNeonSchema(): Promise<boolean> {
  const pool = getNeonPool();
  if (!pool) {
    console.log('[Neon DB] No DATABASE_URL configured; running in local SQLite mode.');
    return false;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS agents (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT DEFAULT '',
          type VARCHAR(64) DEFAULT 'Treasury Manager',
          status VARCHAR(32) DEFAULT 'active',
          balance NUMERIC(18, 8) DEFAULT 0,
          daily_limit NUMERIC(18, 8) DEFAULT 0.05,
          max_tx_amount NUMERIC(18, 8) DEFAULT 0.01,
          spent_today NUMERIC(18, 8) DEFAULT 0,
          tx_count INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          last_active VARCHAR(64) DEFAULT 'Just now',
          avatar_icon VARCHAR(64),
          allowed_recipients JSONB DEFAULT '[]'::jsonb,
          allowed_tokens JSONB DEFAULT '["ETH","USDC"]'::jsonb
        );

        CREATE TABLE IF NOT EXISTS policies (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT DEFAULT '',
          target_agent VARCHAR(64) DEFAULT 'all',
          max_daily_spend NUMERIC(18, 8) NOT NULL,
          max_single_tx NUMERIC(18, 8) NOT NULL,
          require_approval_above NUMERIC(18, 8) DEFAULT 10000,
          allowed_tokens JSONB DEFAULT '["ETH","USDC"]'::jsonb,
          status VARCHAR(32) DEFAULT 'active'
        );

        CREATE TABLE IF NOT EXISTS execution_jobs (
          id VARCHAR(64) PRIMARY KEY,
          task_id VARCHAR(64),
          agent_id VARCHAR(64) NOT NULL,
          agent_name VARCHAR(255) NOT NULL,
          job_id VARCHAR(64) NOT NULL,
          proposal JSONB NOT NULL,
          policy_result JSONB NOT NULL,
          status VARCHAR(32) NOT NULL,
          tx_hash VARCHAR(128),
          explorer_url TEXT,
          block_number BIGINT,
          gas_used TEXT,
          effective_gas_price TEXT,
          executed_at TEXT NOT NULL,
          error TEXT,
          idempotency_key VARCHAR(128) UNIQUE,
          payload_hash VARCHAR(128)
        );

        CREATE TABLE IF NOT EXISTS idempotency_records (
          key VARCHAR(128) PRIMARY KEY,
          payload_hash VARCHAR(128) NOT NULL,
          status VARCHAR(32) NOT NULL,
          job_id VARCHAR(64),
          created_at TEXT NOT NULL,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS audit_records (
          id VARCHAR(64) PRIMARY KEY,
          timestamp TEXT NOT NULL,
          agent_id VARCHAR(64) NOT NULL,
          agent_name VARCHAR(255) NOT NULL,
          task_goal TEXT NOT NULL,
          proposal JSONB NOT NULL,
          policy_check JSONB NOT NULL,
          outcome VARCHAR(32) NOT NULL,
          tx_hash VARCHAR(128),
          explorer_url TEXT,
          block_number BIGINT,
          details TEXT
        );

        CREATE TABLE IF NOT EXISTS system_state (
          key VARCHAR(64) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      console.log('[Neon DB] ✅ Schema initialized on Neon PostgreSQL.');
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Neon DB] ❌ Failed to initialize schema on Neon:', err.message);
    return false;
  }
}

/**
 * Syncs local SQLite records to Neon PostgreSQL for hybrid cloud persistence
 */
export async function syncSqliteToNeon(): Promise<{ syncedAgents: number; syncedPolicies: number; syncedLogs: number }> {
  const pool = getNeonPool();
  if (!pool) return { syncedAgents: 0, syncedPolicies: 0, syncedLogs: 0 };

  const sqlite = getDb();
  const client = await pool.connect();

  try {
    // 1. Sync Agents
    const agents = sqlite.prepare('SELECT * FROM agents').all() as any[];
    for (const a of agents) {
      await client.query(`
        INSERT INTO agents (id, name, description, type, status, balance, daily_limit, max_tx_amount, spent_today, tx_count, created_at, last_active, avatar_icon, allowed_recipients, allowed_tokens)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          balance = EXCLUDED.balance,
          daily_limit = EXCLUDED.daily_limit,
          max_tx_amount = EXCLUDED.max_tx_amount,
          spent_today = EXCLUDED.spent_today,
          tx_count = EXCLUDED.tx_count,
          status = EXCLUDED.status,
          last_active = EXCLUDED.last_active;
      `, [a.id, a.name, a.description, a.type, a.status, a.balance, a.daily_limit, a.max_tx_amount, a.spent_today, a.tx_count, a.created_at, a.last_active, a.avatar_icon, a.allowed_recipients, a.allowed_tokens]);
    }

    // 2. Sync Policies
    const policies = sqlite.prepare('SELECT * FROM policies').all() as any[];
    for (const p of policies) {
      await client.query(`
        INSERT INTO policies (id, name, description, target_agent, max_daily_spend, max_single_tx, require_approval_above, allowed_tokens, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          max_daily_spend = EXCLUDED.max_daily_spend,
          max_single_tx = EXCLUDED.max_single_tx,
          status = EXCLUDED.status;
      `, [p.id, p.name, p.description, p.target_agent, p.max_daily_spend, p.max_single_tx, p.require_approval_above, p.allowed_tokens, p.status]);
    }

    // 3. Sync System State
    const state = sqlite.prepare('SELECT * FROM system_state').all() as any[];
    for (const s of state) {
      await client.query(`
        INSERT INTO system_state (key, value, updated_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at;
      `, [s.key, s.value, s.updated_at]);
    }

    // 4. Sync Audit Records (last 100)
    const audits = sqlite.prepare('SELECT * FROM audit_records ORDER BY timestamp DESC LIMIT 100').all() as any[];
    for (const aud of audits) {
      await client.query(`
        INSERT INTO audit_records (id, timestamp, agent_id, agent_name, task_goal, proposal, policy_check, outcome, tx_hash, explorer_url, block_number, details)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING;
      `, [aud.id, aud.timestamp, aud.agent_id, aud.agent_name, aud.task_goal, aud.proposal, aud.policy_check, aud.outcome, aud.tx_hash, aud.explorer_url, aud.block_number, aud.details]);
    }

    console.log(`[Neon DB] ✅ Synchronized ${agents.length} agents, ${policies.length} policies, and ${audits.length} audit logs to Neon.`);
    return {
      syncedAgents: agents.length,
      syncedPolicies: policies.length,
      syncedLogs: audits.length,
    };
  } finally {
    client.release();
  }
}
