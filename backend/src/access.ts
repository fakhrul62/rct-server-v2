import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Database, type Tx } from './database.js';
import type { Actor } from './auth.js';

@Injectable()
export class Access {
  constructor(private readonly db:Database) {}
  async roles(actor:Actor, tx:Tx=this.db.pool):Promise<string[]> {
    const result=await tx.query<{key:string}>(`SELECT r.key FROM roles r JOIN role_assignments a ON r.id=a.role_id
      WHERE a.employee_id=$1 AND r.status='active' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())`,[actor.employeeId]);
    return result.rows.map(row=>row.key);
  }
  async require(actor:Actor, allowed:string[], tx?:Tx) {
    const roles=await this.roles(actor,tx);
    if (!roles.some(r=>allowed.includes(r))) throw new ForbiddenException();
    return roles;
  }
  async profileFields(actor:Actor, target:string, mode:'read'|'write', tx:Tx=this.db.pool) {
    const roles=await this.roles(actor,tx);
    const own=target===actor.employeeId;
    const maySeeAll=roles.some(r=>['ceo','dgm','hr'].includes(r));
    if ((mode==='write' && !roles.includes('ceo')) || (mode==='read' && !own && !maySeeAll)) throw new ForbiddenException();
    const result=await tx.query<{field_key:string}>(`
      SELECT DISTINCT f.field_key FROM role_assignments a
      JOIN roles r ON r.id=a.role_id AND r.status='active'
      JOIN role_permissions g ON g.role_id=r.id AND g.revoked_at IS NULL
      JOIN permissions p ON p.id=g.permission_id AND p.status='active'
      JOIN access_resources ar ON ar.id=p.resource_id AND ar.status='active'
      JOIN field_policies fp ON fp.role_permission_id=g.id AND fp.revoked_at IS NULL
      JOIN resource_fields f ON f.id=fp.resource_field_id AND f.resource_id=p.resource_id AND f.status='active'
      WHERE a.employee_id=$1 AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())
      AND p.key=$2 AND (g.record_scope='all' OR (g.record_scope='own' AND $3::boolean))
      AND (fp.access_level='write' OR (fp.access_level='read' AND $4='read'))`,
      [actor.employeeId,mode==='read'?'employee_profile.read':'employee_profile.update',own,mode]);
    return new Set(result.rows.map(x=>x.field_key));
  }
}

export async function requireRow(tx:Tx, sql:string, values:unknown[]) {
  const row=(await tx.query(sql,values)).rows[0];
  if (!row) throw new NotFoundException();
  return row;
}
