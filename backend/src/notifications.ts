import { Injectable } from '@nestjs/common';
import { requireRow } from './access.js';
import type { Actor } from './auth.js';
import { audit, Database, type Tx } from './database.js';

export const notify=(tx:Tx, employee:string, request:string, event:string, actor:string)=>
  tx.query(`INSERT INTO identity_notifications(employee_id,request_id,event_key,created_by,updated_by)
    VALUES($1,$2,$3,$4,$4)`,[employee,request,event,actor]);

@Injectable()
export class Notifications {
  constructor(private readonly db:Database) {}
  async list(actor:Actor) {
    return (await this.db.query(`SELECT id,request_id,event_key,read_at,created_at FROM identity_notifications
      WHERE employee_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[actor.employeeId])).rows;
  }
  async read(actor:Actor,id:string) {
    await this.db.transaction(async tx=>{
      const row=await requireRow(tx,`SELECT read_at FROM identity_notifications WHERE id=$1 AND employee_id=$2 FOR UPDATE`,[id,actor.employeeId]);
      if (row.read_at) return;
      await tx.query(`UPDATE identity_notifications SET read_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1`,[id,actor.accountId]);
      await audit(tx,actor.accountId,'notification.read','identity_notification',id,null,null,actor.employeeId);
    });
  }
}
