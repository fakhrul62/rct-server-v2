import { NotFoundException } from '@nestjs/common';
import type { Tx } from './database.js';

export const recordTables: Readonly<Record<string, IdentityTable>> = {
  employee:'employees', account:'user_accounts', session:'login_sessions', shift:'shifts',
  employee_document:'employee_documents', employee_payment:'employee_payment_details',
  role:'roles', role_permission:'role_permissions', field_policy:'field_policies',
  organization_request:'organization_requests', delegation:'delegations',
  identity_notification:'identity_notifications', otp_challenge:'otp_challenges',
};
export type IdentityTable =
  'employees'|'user_accounts'|'login_sessions'|'shifts'|'employee_documents'|'employee_payment_details'|
  'roles'|'role_permissions'|'permissions'|'field_policies'|'resource_fields'|'access_resources'|
  'organization_requests'|'delegations'|'identity_notifications'|'audit_events'|'otp_challenges';

export async function internalId(db:Tx, table:IdentityTable, uuid:string):Promise<string> {
  // Table identifiers come only from the fixed application catalog.
  const row=(await db.query<{id:string}>(`SELECT id FROM identity_live.${table} WHERE uuid=$1`,[uuid])).rows[0];
  if (!row) throw new NotFoundException('Record not found');
  return row.id;
}
export async function uuidFor(db:Tx, table:IdentityTable, id:string):Promise<string> {
  // Resolve historical references even when their target is retired.
  const row=(await db.query<{uuid:string}>(`SELECT uuid FROM identity.${table} WHERE id=$1`,[id])).rows[0];
  if (!row) throw new Error('Missing public ID for '+table);
  return row.uuid;
}
type Mapping = Readonly<Record<string, IdentityTable>>;
export async function publicRows<T extends Record<string,unknown>>(db:Tx, rows:T[], mapping:Mapping):Promise<T[]> {
  const pending=new Map<IdentityTable,Set<string>>();
  for (const row of rows) {
    for (const [key,table] of Object.entries(mapping)) {
      const value=row[key];
      if (value==null) continue;
      if (typeof value!=='string' || !/^\d+$/.test(value)) throw new Error('Expected internal ID for '+key);
      if (!pending.has(table)) pending.set(table,new Set());
      pending.get(table)!.add(value);
    }
  }
  const resolved=new Map<IdentityTable,Map<string,string>>();
  for (const [table,ids] of pending) {
    const result=await db.query<{id:string;uuid:string}>(`SELECT id,uuid FROM identity.${table} WHERE id=ANY($1::bigint[])`,[[...ids]]);
    resolved.set(table,new Map(result.rows.map(row=>[row.id,row.uuid])));
  }
  return rows.map(row=>{
    const projected:Record<string,unknown>={...row};
    for (const [key,table] of Object.entries(mapping)) {
      const value=row[key];
      if (value==null) continue;
      const uuid=resolved.get(table)?.get(value as string);
      if (!uuid) throw new Error('Missing public ID for '+key);
      projected[key]=uuid;
    }
    return projected as T;
  });
}
export async function publicRow<T extends Record<string,unknown>>(db:Tx, row:T, mapping:Mapping):Promise<T> {
  return (await publicRows(db,[row],mapping))[0];
}
const auditLinks:Mapping = {
  employee_id:'employees', reporting_boss_id:'employees', reportingBossId:'employees', shift_id:'shifts',
  role_id:'roles', roleId:'roles', permission_id:'permissions', role_permission_id:'role_permissions',
  resource_field_id:'resource_fields', delegationId:'delegations', delegator_employee_id:'employees', delegate_employee_id:'employees',
};
export function publicAuditValues(db:Tx, table:IdentityTable, value:unknown) {
  if (value==null || typeof value!=='object' || Array.isArray(value)) return value;
  return publicRow(db,value as Record<string,unknown>,{id:table,...auditLinks});
}
