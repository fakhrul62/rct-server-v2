import { readFile, readdir } from 'node:fs/promises';
import { makePool } from './database.js';
const pool = makePool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(38510)');
  await client.query('CREATE TABLE IF NOT EXISTS public.rct_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const directory = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(x => x.endsWith('.sql')).sort()) {
    const {rowCount} = await client.query('SELECT 1 FROM public.rct_migrations WHERE name=$1', [name]);
    if (rowCount) continue;
    await client.query(await readFile(new URL(name, directory), 'utf8'));
    await client.query('INSERT INTO public.rct_migrations(name) VALUES($1)', [name]);
    console.log('Applied', name);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally { client.release(); await pool.end(); }
