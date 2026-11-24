import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg, { type PoolClient, type QueryResultRow } from 'pg';

export type Tx = Pick<PoolClient, 'query'>;
export function makePool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=identity,public' });
}
@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool = makePool();
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
    return this.pool.query<T>(sql, params);
  }
  async transaction<T>(work: (db: Tx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async onModuleDestroy() { await this.pool.end(); }
}
export async function audit(db: Tx, actor: string | null, action: string, resource: string,
  record: string | null, before: unknown = null, after: unknown = null, employee: string | null = null,
  context?: { ip?: string; device?: string }) {
  await db.query(
    `INSERT INTO audit_events(actor_account_id,subject_employee_id,action_key,resource_key,record_id,
      occurred_at,before_values,after_values,source_ip,device_label,created_by,updated_by)
     VALUES ($1,$2,$3,$4,$5,now(),$6,$7,$8,$9,$1,$1)`,
    [actor, employee, action, resource, record, before, after, context?.ip ?? null, context?.device ?? null],
  );
}
