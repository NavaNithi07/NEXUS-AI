import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in server/.env');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('Successfully connected to Neon database!');

    const res = await client.query('SELECT current_database(), current_user, version(), now();');
    console.log('Query Result:', res.rows[0]);

    // Inspect existing tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Existing tables in public schema:', tablesRes.rows.map(r => r.table_name));

    client.release();
    await pool.end();
  } catch (err: any) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

testConnection();
