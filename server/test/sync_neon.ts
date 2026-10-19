// server/test/sync_neon.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { initializeNeonSchema, syncSqliteToNeon, getNeonPool } from '../src/db/neon.js';

async function main() {
  console.log('--- Initializing Neon PostgreSQL Schema ---');
  const schemaSuccess = await initializeNeonSchema();
  if (!schemaSuccess) {
    console.error('Failed to initialize Neon schema.');
    process.exit(1);
  }

  console.log('--- Syncing Authoritative State to Neon ---');
  const result = await syncSqliteToNeon();
  console.log('Sync result:', result);

  const pool = getNeonPool();
  if (pool) {
    const client = await pool.connect();
    const countAgents = await client.query('SELECT count(*) FROM agents;');
    const countPolicies = await client.query('SELECT count(*) FROM policies;');
    const countAudits = await client.query('SELECT count(*) FROM audit_records;');
    const systemState = await client.query('SELECT * FROM system_state;');

    console.log('\n--- Neon PostgreSQL Verification ---');
    console.log('Agents count in Neon:', countAgents.rows[0].count);
    console.log('Policies count in Neon:', countPolicies.rows[0].count);
    console.log('Audit records count in Neon:', countAudits.rows[0].count);
    console.log('System state in Neon:', systemState.rows);

    client.release();
    await pool.end();
  }
}

main().catch(console.error);
