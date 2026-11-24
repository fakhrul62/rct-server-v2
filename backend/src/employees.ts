import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Access, requireRow } from './access.js';
import { endSessions, hashPassword, type Actor } from './auth.js';
import { profileEditFields, profileFields } from './catalog.js';
import { audit, Database, type Tx } from './database.js';
import { ActivateDto, EmployeeDto, PaymentDto, ShiftDto } from './dto.js';
import { randomUUID } from 'node:crypto';
import { documentTypes, type EmployeeFile } from './employee-file.js';

const staff=['ceo','hr'];
@Injectable()
export class Employees {
  constructor(private readonly db:Database, private readonly access:Access) {}
  async list(actor:Actor, offset:number) {
    const roles=await this.access.roles(actor);
    const isWide=roles.some(r=>['ceo','dgm','hr'].includes(r));
    const rows=(await this.db.query(
      `SELECT id FROM employees WHERE $1::boolean OR id=$2 ORDER BY employee_code LIMIT 50 OFFSET $3`,
      [isWide,actor.employeeId,offset])).rows;
    const items=[];
    for (const row of rows) {
      const fields=await this.access.profileFields(actor,row.id,'read');
      if (fields.size) items.push(await this.read(actor,row.id));
    }
    return items;
  }
  async read(actor:Actor, employeeId:string) {
    const fields=await this.access.profileFields(actor,employeeId,'read');
    if (!fields.size) throw new ForbiddenException();
    const row=await requireRow(this.db.pool,`SELECT id,employee_code,name,email,phone,address,nid,birth_date,photo_ref,
      emergency_contact_name,emergency_contact_phone,joined_on,probation_end_on,employment_status,
      executor_subtype,gross_salary,reporting_boss_id,shift_id FROM employees WHERE id=$1`,[employeeId]);
    return Object.fromEntries(Object.entries(row).filter(([key])=>Object.hasOwn(profileFields,key)&&fields.has(key)));
  }
  async add(actor:Actor, body:EmployeeDto) {
    await this.access.require(actor,staff);
    const password=await hashPassword(body.temporaryPassword);
    return this.db.transaction(async tx=>{
      await this.access.require(actor,staff,tx);
      if (body.probationEndOn) {
        const valid=(await tx.query(`SELECT $2::date BETWEEN $1::date+interval '1 month' AND $1::date+interval '6 months' AS valid`,
          [body.joinedOn,body.probationEndOn])).rows[0].valid;
        if (!valid) throw new BadRequestException('Probation must be between one and six months from joining');
      }
      const employee=(await tx.query(`INSERT INTO employees(name,email,joined_on,employment_status,probation_end_on,created_by,updated_by,
          phone,address,nid,birth_date,photo_ref,emergency_contact_name,emergency_contact_phone,executor_subtype)
        VALUES($1,$2,$3,'pending_onboarding',$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING id,employee_code,name,employment_status`,
        [body.name,body.email.trim().toLowerCase(),body.joinedOn,body.probationEndOn??null,actor.accountId,
          body.phone??null,body.address??null,body.nid??null,body.birthDate??null,body.photoRef??null,
          body.emergencyContactName??null,body.emergencyContactPhone??null,body.executorSubtype??null])).rows[0];
      await tx.query(`INSERT INTO user_accounts(employee_id,password_hash,password_change_status,account_status,created_by,updated_by)
        VALUES($1,$2,'required','pending_activation',$3,$3)`,[employee.id,password,actor.accountId]);
      await audit(tx,actor.accountId,'employee.created','employee',employee.id,null,employee,employee.id);
      return employee;
    });
  }
  private async checkBoss(tx:Tx, employee:string, boss:string) {
    await tx.query('SELECT pg_advisory_xact_lock(38512)');
    await requireRow(tx,`SELECT id FROM employees WHERE id=$1 AND employment_status NOT IN ('exited','pending_onboarding')`,[boss]);
    const cycle=(await tx.query(`WITH RECURSIVE chain AS (
       SELECT id,reporting_boss_id FROM employees WHERE id=$1 UNION
       SELECT e.id,e.reporting_boss_id FROM employees e JOIN chain c ON e.id=c.reporting_boss_id)
       SELECT 1 FROM chain WHERE id=$2`,[boss,employee])).rowCount;
    if (cycle) throw new ConflictException('Reporting relationship creates a cycle');
  }
  async activate(actor:Actor, id:string, body:ActivateDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      await tx.query('SELECT pg_advisory_xact_lock(38512)');
      const employee=await requireRow(tx,'SELECT id,probation_end_on FROM employees WHERE id=$1 FOR UPDATE',[id]);
      const account=await requireRow(tx,'SELECT id,account_status FROM user_accounts WHERE employee_id=$1 FOR UPDATE',[id]);
      if (account.account_status!=='pending_activation') throw new ConflictException('Account is not pending activation');
      await this.checkBoss(tx,id,body.reportingBossId);
      const role=await requireRow(tx,`SELECT id,key FROM roles WHERE id=$1 AND status='active'`,[body.roleId]);
      if (role.key==='ceo') throw new ForbiddenException('CEO succession is not handled by onboarding');
      await tx.query(`UPDATE employees SET reporting_boss_id=$2,employment_status=$3,updated_at=now(),updated_by=$4 WHERE id=$1`,
        [id,body.reportingBossId,employee.probation_end_on?'probation':'confirmed',actor.accountId]);
      await tx.query(`UPDATE user_accounts SET account_status='active',activated_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1`,[account.id,actor.accountId]);
      await tx.query(`INSERT INTO role_assignments(employee_id,role_id,valid_from,created_by,updated_by)
        VALUES($1,$2,now(),$3,$3)`,[id,body.roleId,actor.accountId]);
      await audit(tx,actor.accountId,'employee.activated','employee',id,{status:'pending_activation'},{status:'active',roleId:role.id,reportingBossId:body.reportingBossId},id);
    });
  }
  async resetPassword(actor:Actor, employee:string, password:string) {
    await this.access.require(actor,staff);
    const hash=await hashPassword(password);
    await this.db.transaction(async tx=>{
      const roles=await this.access.require(actor,staff,tx);
      if (actor.employeeId===employee) throw new ForbiddenException('Use change-password for your own account');
      const account=await requireRow(tx,`SELECT id,account_status FROM user_accounts WHERE employee_id=$1 FOR UPDATE`,[employee]);
      const isCeo=(await this.access.roles({...actor,employeeId:employee},tx)).includes('ceo');
      if (isCeo || account.account_status==='closed') throw new ForbiddenException();
      await tx.query(`UPDATE user_accounts SET password_hash=$2,password_change_status='required',
        updated_at=now(),updated_by=$3 WHERE id=$1`,[account.id,hash,actor.accountId]);
      await endSessions(tx,account.id,'password_reset',actor.accountId);
      await audit(tx,actor.accountId,'account.password_reset','account',account.id,null,null,employee);
    });
  }
  async changeBoss(actor:Actor, employee:string, boss:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      await tx.query('SELECT pg_advisory_xact_lock(38512)');
      const before=await requireRow(tx,'SELECT reporting_boss_id FROM employees WHERE id=$1 FOR UPDATE',[employee]);
      await this.checkBoss(tx,employee,boss);
      await tx.query('UPDATE employees SET reporting_boss_id=$2,updated_at=now(),updated_by=$3 WHERE id=$1',[employee,boss,actor.accountId]);
      await audit(tx,actor.accountId,'employee.boss_changed','employee',employee,before,{reporting_boss_id:boss},employee);
    });
  }
  async setSalary(actor:Actor, employee:string, salary:number) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const before=await requireRow(tx,'SELECT gross_salary FROM employees WHERE id=$1 FOR UPDATE',[employee]);
      await tx.query('UPDATE employees SET gross_salary=$2,updated_at=now(),updated_by=$3 WHERE id=$1',[employee,salary,actor.accountId]);
      await audit(tx,actor.accountId,'employee.salary_changed','employee',employee,before,{gross_salary:salary},employee);
    });
  }
  async editProfile(actor:Actor, employee:string, field:string, value:string) {
    await this.db.transaction(async tx=>{
      const fields=await this.access.profileFields(actor,employee,'write',tx);
      if (!fields.has(field)) throw new ForbiddenException();
      await this.applyProfile(tx,actor.accountId,employee,field,value);
    });
  }
  async applyProfile(tx:Tx, editor:string, employee:string, field:string, value:string) {
    const column=profileEditFields.find(key=>key===field);
    if (!column) throw new BadRequestException('This field cannot be changed');
    const before=await requireRow(tx,`SELECT ${column} FROM employees WHERE id=$1 FOR UPDATE`,[employee]);
    await tx.query(`UPDATE employees SET ${column}=$2,updated_at=now(),updated_by=$3 WHERE id=$1`,[employee,value,editor]);
    await audit(tx,editor,'employee.profile_changed','employee',employee,before,{[column]:value},employee);
  }
  async orgChart(actor:Actor) {
    await this.access.require(actor,['ceo','hr','dgm','stl','sales_executive','pm','executor']);
    return (await this.db.query(`SELECT id,name,reporting_boss_id FROM employees WHERE employment_status IN
      ('probation','confirmed','exit_pending') ORDER BY name`)).rows;
  }
  async createShift(actor:Actor, body:ShiftDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const shift=(await tx.query(`INSERT INTO shifts(code,name,starts_at,ends_at,status,created_by,updated_by)
        VALUES($1,$2,$3,$4,'active',$5,$5) RETURNING id,code,name,starts_at,ends_at,status`,
        [body.code,body.name,body.startsAt,body.endsAt,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'shift.created','shift',shift.id,null,shift);
      return shift;
    });
  }
  async listShifts() {
    return (await this.db.query(`SELECT id,code,name,starts_at,ends_at,status FROM shifts ORDER BY code`)).rows;
  }
  async assignShift(actor:Actor, id:string, shift:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,staff,tx);
      await requireRow(tx,`SELECT id FROM shifts WHERE id=$1 AND status='active'`,[shift]);
      const before=await requireRow(tx,'SELECT shift_id FROM employees WHERE id=$1 FOR UPDATE',[id]);
      await tx.query('UPDATE employees SET shift_id=$2,updated_at=now(),updated_by=$3 WHERE id=$1',[id,shift,actor.accountId]);
      await audit(tx,actor.accountId,'employee.shift_assigned','employee',id,before,{shift_id:shift},id);
    });
  }
  async documents(actor:Actor, employee:string) {
    if (actor.employeeId!==employee) await this.access.require(actor,['ceo','hr','dgm']);
    return (await this.db.query(`SELECT id,document_type,status,file_name,content_type,created_at FROM employee_documents WHERE employee_id=$1 ORDER BY created_at DESC`,[employee])).rows;
  }
  async authorizeDocumentUpload(actor:Actor) {
    await this.access.require(actor,staff);
  }
  async addDocument(actor:Actor, employee:string, type:string, file:EmployeeFile) {
    if (!documentTypes.includes(type)) throw new BadRequestException('Choose a valid document type');
    return this.db.transaction(async tx=>{
      await this.access.require(actor,staff,tx);
      await requireRow(tx,'SELECT id FROM employees WHERE id=$1',[employee]);
      const doc=(await tx.query(`INSERT INTO employee_documents(employee_id,document_type,storage_ref,status,
          created_by,updated_by,file_name,content_type,content_bytes)
        VALUES($1,$2,$3,'active',$4,$4,$5,$6,$7) RETURNING id,document_type,status,file_name,content_type`,
        [employee,type,'db:'+randomUUID(),actor.accountId,file.fileName,file.contentType,file.bytes])).rows[0];
      await audit(tx,actor.accountId,'employee.document_added','employee_document',doc.id,null,doc,employee);
      return doc;
    });
  }
  async downloadDocument(actor:Actor, employee:string, document:string) {
    if (actor.employeeId!==employee) await this.access.require(actor,['ceo','hr','dgm']);
    return await requireRow(this.db.pool,`SELECT content_bytes,content_type FROM employee_documents
      WHERE id=$1 AND employee_id=$2 AND status='active' AND content_bytes IS NOT NULL`,[document,employee]);
  }
  async updatePayment(actor:Actor, employee:string, body:PaymentDto) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      await this.applyPayment(tx,actor.accountId,employee,body);
    });
  }
  async applyPayment(tx:Tx, actor:string, employee:string, body:PaymentDto) {
    await requireRow(tx,'SELECT id FROM employees WHERE id=$1 FOR UPDATE',[employee]);
    const before=(await tx.query('SELECT payment_method,provider_name FROM employee_payment_details WHERE employee_id=$1',[employee])).rows[0]??null;
    const row=(await tx.query(`INSERT INTO employee_payment_details(employee_id,payment_method,provider_name,account_reference,account_holder_name,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$6) ON CONFLICT(employee_id) DO UPDATE SET payment_method=excluded.payment_method,
      provider_name=excluded.provider_name,account_reference=excluded.account_reference,account_holder_name=excluded.account_holder_name,
      updated_at=now(),updated_by=excluded.updated_by RETURNING id,payment_method,provider_name`,
      [employee,body.method,body.provider,body.accountReference,body.accountHolder??null,actor])).rows[0];
    await audit(tx,actor,'employee.payment_updated','employee_payment',row.id,before,row,employee);
  }
  async accountStatus(actor:Actor,employee:string,status:'active'|'suspended') {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const account=await requireRow(tx,`SELECT id,account_status FROM user_accounts WHERE employee_id=$1 FOR UPDATE`,[employee]);
      if ((await this.access.roles({...actor,employeeId:employee},tx)).includes('ceo')) throw new ForbiddenException();
      if (!['active','suspended'].includes(account.account_status) || status===account.account_status) {
        throw new ConflictException('Only active or suspended accounts can change state here');
      }
      await tx.query('UPDATE user_accounts SET account_status=$2,updated_at=now(),updated_by=$3 WHERE id=$1',
        [account.id,status,actor.accountId]);
      if (status==='suspended') await endSessions(tx,account.id,'account_disabled',actor.accountId);
      await audit(tx,actor.accountId,'account.status_changed','account',account.id,{status:account.account_status},{status},employee);
    });
  }
  async archiveDocument(actor:Actor,employee:string,id:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      await requireRow(tx,`UPDATE employee_documents SET status='archived',updated_at=now(),updated_by=$3
        WHERE id=$1 AND employee_id=$2 AND status='active' RETURNING id`,[id,employee,actor.accountId]);
      await audit(tx,actor.accountId,'employee.document_archived','employee_document',id,{status:'active'},{status:'archived'},employee);
    });
  }
  async payment(actor:Actor, employee:string) {
    if (actor.employeeId!==employee) await this.access.require(actor,['ceo','hr','dgm']);
    return (await this.db.query(`SELECT payment_method,provider_name,account_holder_name,
      right(account_reference,4) AS reference_last_four FROM employee_payment_details WHERE employee_id=$1`,[employee])).rows[0]??null;
  }
}
