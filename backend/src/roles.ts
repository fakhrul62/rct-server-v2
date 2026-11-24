import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Access, requireRow } from './access.js';
import type { Actor } from './auth.js';
import { audit, Database } from './database.js';
import type { FieldPolicyDto, GrantDto, RoleDto, RoleUpdateDto } from './dto.js';

@Injectable()
export class RoleManagement {
  constructor(private readonly db:Database,private readonly access:Access) {}
  async list() {
    return (await this.db.query('SELECT id,key,name,description,role_kind,status,version FROM roles ORDER BY key')).rows;
  }
  async catalog(actor:Actor) {
    await this.access.require(actor,['ceo']);
    const permissions=(await this.db.query('SELECT id,resource_id,key,description,sensitivity,status FROM permissions ORDER BY key')).rows;
    const fields=(await this.db.query(`SELECT f.id,r.key AS resource,f.field_key,f.description,f.sensitivity,f.status
      FROM resource_fields f JOIN access_resources r ON r.id=f.resource_id ORDER BY r.key,f.field_key`)).rows;
    return { permissions,fields };
  }
  async grants(actor:Actor,id:string) {
    await this.access.require(actor,['ceo']);
    return (await this.db.query(`SELECT g.id,g.permission_id,p.key,g.record_scope,g.revoked_at,
      coalesce((SELECT jsonb_agg(jsonb_build_object('field',f.field_key,'access',fp.access_level))
      FROM field_policies fp JOIN resource_fields f ON f.id=fp.resource_field_id
      WHERE fp.role_permission_id=g.id AND fp.revoked_at IS NULL),'[]') AS fields
      FROM role_permissions g JOIN permissions p ON p.id=g.permission_id WHERE g.role_id=$1 ORDER BY p.key`,[id])).rows;
  }
  async create(actor:Actor,body:RoleDto) {
    if (!/^[a-z][a-z0-9_]{1,69}$/.test(body.key)) throw new BadRequestException('Use a lowercase role key with underscores');
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const role=(await tx.query(`INSERT INTO roles(key,name,description,role_kind,status,created_by,updated_by)
        VALUES($1,$2,$3,'custom','active',$4,$4) RETURNING id,key,name,description,status,version`,[body.key,body.name,body.description,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'access.role_created','role',role.id,null,role);
      return role;
    });
  }
  async update(actor:Actor,id:string,body:RoleUpdateDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const before=await requireRow(tx,'SELECT name,description,version,status FROM roles WHERE id=$1 FOR UPDATE',[id]);
      if (before.status!=='active'||before.version!==body.version) throw new ConflictException('Reload the current role and try again');
      const role=(await tx.query(`UPDATE roles SET name=$2,description=$3,version=version+1,updated_at=now(),updated_by=$4
        WHERE id=$1 RETURNING id,key,name,description,status,version`,[id,body.name,body.description,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'access.role_updated','role',id,before,role);
      return role;
    });
  }
  async archive(actor:Actor,id:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const row=await requireRow(tx,'SELECT id,role_kind,status FROM roles WHERE id=$1 FOR UPDATE',[id]);
      if (row.role_kind==='system' || row.status!=='active') throw new ConflictException('Only active custom roles can be archived');
      await tx.query(`UPDATE roles SET status='archived',version=version+1,updated_at=now(),updated_by=$2 WHERE id=$1`,[id,actor.accountId]);
      await audit(tx,actor.accountId,'access.role_archived','role',id,{status:'active'},{status:'archived'});
    });
  }
  async grant(actor:Actor,id:string,body:GrantDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      await requireRow(tx,`SELECT id FROM roles WHERE id=$1 AND status='active' FOR UPDATE`,[id]);
      await requireRow(tx,`SELECT id FROM permissions WHERE id=$1 AND status='active'`,[body.permissionId]);
      const grant=(await tx.query(`INSERT INTO role_permissions(role_id,permission_id,record_scope,created_by,updated_by)
        VALUES($1,$2,$3,$4,$4) RETURNING id,role_id,permission_id,record_scope`,[id,body.permissionId,body.scope,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'access.permission_granted','role_permission',grant.id,null,grant);
      return grant;
    });
  }
  async revoke(actor:Actor,id:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const row=await requireRow(tx,`UPDATE role_permissions SET revoked_at=now(),updated_at=now(),updated_by=$2
        WHERE id=$1 AND revoked_at IS NULL RETURNING id,role_id,permission_id,revoked_at`,[id,actor.accountId]);
      await audit(tx,actor.accountId,'access.permission_revoked','role_permission',id,null,row);
    });
  }
  async fieldPolicy(actor:Actor,id:string,body:FieldPolicyDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const grant=await requireRow(tx,`SELECT p.resource_id,p.action FROM role_permissions g
        JOIN permissions p ON p.id=g.permission_id WHERE g.id=$1 AND g.revoked_at IS NULL FOR UPDATE OF g`,[id]);
      const field=await requireRow(tx,`SELECT id,resource_id,field_key FROM resource_fields WHERE id=$1 AND status='active'`,[body.resourceFieldId]);
      if (field.resource_id!==grant.resource_id) throw new BadRequestException('Permission and field have different resources');
      if (grant.action==='read' && body.access==='write') throw new BadRequestException('Write requires an update permission');
      const before=(await tx.query(`UPDATE field_policies SET revoked_at=now(),version=version+1,updated_at=now(),updated_by=$3
        WHERE role_permission_id=$1 AND resource_field_id=$2 AND revoked_at IS NULL RETURNING access_level`,
        [id,field.id,actor.accountId])).rows[0]??null;
      const policy=(await tx.query(`INSERT INTO field_policies(role_permission_id,resource_field_id,access_level,created_by,updated_by)
        VALUES($1,$2,$3,$4,$4) RETURNING id,role_permission_id,resource_field_id,access_level`,
        [id,field.id,body.access,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'access.field_policy_set','field_policy',policy.id,before,policy);
      return policy;
    });
  }
}
