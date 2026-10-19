// server/src/db/database.ts
// SQLite persistent database for all authoritative state
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../nexus-wallet.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initializeSchema(_db);
  return _db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      failed_attempts INTEGER DEFAULT 0,
      lockout_until INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      type TEXT DEFAULT 'Treasury Manager',
      status TEXT DEFAULT 'active',
      balance REAL DEFAULT 0,
      daily_limit REAL DEFAULT 0.05,
      max_tx_amount REAL DEFAULT 0.01,
      spent_today REAL DEFAULT 0,
      tx_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      last_active TEXT DEFAULT 'Just now',
      avatar_icon TEXT,
      allowed_recipients TEXT DEFAULT '[]',
      allowed_tokens TEXT DEFAULT '["ETH","USDC"]'
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      target_agent TEXT DEFAULT 'all',
      max_daily_spend REAL NOT NULL,
      max_single_tx REAL NOT NULL,
      require_approval_above REAL DEFAULT 10000,
      allowed_tokens TEXT DEFAULT '["ETH","USDC"]',
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS execution_jobs (
      id TEXT PRIMARY KEY,
      task_id TEXT,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      job_id TEXT NOT NULL,
      proposal TEXT NOT NULL,
      policy_result TEXT NOT NULL,
      status TEXT NOT NULL,
      tx_hash TEXT,
      explorer_url TEXT,
      block_number INTEGER,
      gas_used TEXT,
      effective_gas_price TEXT,
      executed_at TEXT NOT NULL,
      error TEXT,
      idempotency_key TEXT UNIQUE,
      payload_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS idempotency_records (
      key TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      job_id TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      task_goal TEXT NOT NULL,
      proposal TEXT NOT NULL,
      policy_check TEXT NOT NULL,
      outcome TEXT NOT NULL,
      tx_hash TEXT,
      explorer_url TEXT,
      block_number INTEGER,
      details TEXT,
      prev_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
      record_hash TEXT,
      sequence_number INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Seed default system state if not set
    INSERT OR IGNORE INTO system_state (key, value, updated_at)
    VALUES ('emergency_paused', 'false', datetime('now'));

    -- Seed default agent if none exist
    INSERT OR IGNORE INTO agents (
      id, name, description, type, status, balance,
      daily_limit, max_tx_amount, spent_today, tx_count,
      created_at, last_active, allowed_recipients, allowed_tokens
    ) VALUES (
      'ag-base-01',
      'Autonomous Treasury Bot',
      'Autonomous testnet gas allocation and rebalancing bot with strict limits.',
      'Treasury Manager',
      'active',
      100,
      0.05,
      0.01,
      0,
      0,
      date('now'),
      'Just now',
      '["0x70997970C51812dc3A010C7d01b50e0d17dc79C8","0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC","0x90F79bf6EB2c4f870365E785982E1f101E93b906"]',
      '["ETH","USDC"]'
    );

    -- Seed default policy if none exist
    INSERT OR IGNORE INTO policies (
      id, name, description, target_agent, max_daily_spend,
      max_single_tx, require_approval_above, allowed_tokens, status
    ) VALUES (
      'pol-global-01',
      'Testnet Value & Gas Cap Guard',
      'Limits single transaction native ETH transfers to 0.01 ETH and daily to 0.05 ETH.',
      'all',
      0.05,
      0.01,
      0.008,
      '["ETH","USDC"]',
      'active'
    );
  `);

  try {
    const pragmaJobs = db.pragma('table_info(execution_jobs)') as any[];
    if (pragmaJobs && !pragmaJobs.some((col: any) => col.name === 'payload_hash')) {
      db.exec('ALTER TABLE execution_jobs ADD COLUMN payload_hash TEXT;');
    }

    const pragmaAudits = db.pragma('table_info(audit_records)') as any[];
    if (pragmaAudits) {
      if (!pragmaAudits.some((col: any) => col.name === 'prev_hash')) {
        db.exec("ALTER TABLE audit_records ADD COLUMN prev_hash TEXT DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';");
      }
      if (!pragmaAudits.some((col: any) => col.name === 'record_hash')) {
        db.exec("ALTER TABLE audit_records ADD COLUMN record_hash TEXT;");
      }
      if (!pragmaAudits.some((col: any) => col.name === 'sequence_number')) {
        db.exec("ALTER TABLE audit_records ADD COLUMN sequence_number INTEGER DEFAULT 1;");
      }
    }
  } catch {
    // Migration handled or already applied
  }
}

export default getDb;
