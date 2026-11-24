import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Access, requireRow } from './access.js';
import { cancelOtp, endSessions, type Actor } from './auth.js';
import { audit, Database, type Tx } from './database.js';
import type { DecisionDto, DelegationDto, EmploymentRequestDto, PaymentDto, ProfileRequestDto, RoleRequestDto } from './dto.js';
import { Employees } from './employees.js';
import { publicRow, publicRows } from './public-ids.js';
import { notify } from './notifications.js';

const localDay="(now() AT TIME ZONE 'Asia/Dhaka')::date";
type Step={employee:string; kind:'recommend'|'approve'};
@Injectable()
export class Workflow {
  constructor(private readonly db:Database,private readonly access:Access,private readonly employees:Employees) {}
  private async reviewer(tx:Tx,role:string,exclude:string,preferred?:string) {
    const found=(await tx.query(`SELECT e.id FROM employees e JOIN user_accounts u ON u.employee_id=e.id AND u.account_status='active'
      JOIN role_assignments a ON a.employee_id=e.id JOIN roles r ON r.id=a.role_id AND r.status='active'
      WHERE r.key=$1 AND e.id<>$2 AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())
      ORDER BY (e.id=$3) DESC NULLS LAST,e.id LIMIT 1`,[role,exclude,preferred??null])).rows[0];
    if (!found) throw new ConflictException('An eligible '+role+' reviewer is required');
    return found.id as string;
  }
  private async submit(tx:Tx, actor:Actor, employee:string, type:string, reason:string|null, steps:Step[],
      outcome:string|null=null, date:string|null=null) {
    const result=(await tx.query(`INSERT INTO organization_requests(employee_id,requested_by_account_id,request_type,request_status,
      reason,submitted_at,probation_outcome,proposed_probation_end_on,created_by,updated_by)
      VALUES($1,$2,$3,'pending',$4,now(),$5,$6,$2,$2) RETURNING id,employee_id,request_type,request_status`,
      [employee,actor.accountId,type,reason,outcome,date])).rows[0];
    let order=0;
    for (const step of steps) {
      await tx.query(`INSERT INTO organization_approval_steps(request_id,step_order,assigned_employee_id,step_kind,decision,created_by,updated_by)
        VALUES($1,$2,$3,$4,'pending',$5,$5)`,[result.id,++order,step.employee,step.kind,actor.accountId]);
    }
    await notify(tx,steps[0].employee,result.id,'approval.pending',actor.accountId);
    await audit(tx,actor.accountId,'organization.request_submitted','organization_request',result.id,null,result,employee);
    return result;
  }
  async roleRequest(actor:Actor,body:RoleRequestDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['hr','ceo'],tx);
      await requireRow(tx,`SELECT id FROM employees WHERE id=$1 AND employment_status IN ('probation','confirmed')`,[body.employeeId]);
      const role=await requireRow(tx,`SELECT key FROM roles WHERE id=$1 AND status='active'`,[body.roleId]);
      if (role.key==='ceo') throw new ForbiddenException('CEO succession is out of scope');
      const hr=await this.reviewer(tx,'hr',body.employeeId,actor.employeeId);
      const ceo=await this.reviewer(tx,'ceo',body.employeeId);
      const request=await this.submit(tx,actor,body.employeeId,'role_change',body.reason,[{employee:hr,kind:'recommend'},{employee:ceo,kind:'approve'}]);
      await tx.query(`INSERT INTO role_change_items(request_id,role_id,operation,created_by,updated_by)
        VALUES($1,$2,$3,$4,$4)`,[request.id,body.roleId,body.operation,actor.accountId]);
      return publicRow(tx,request,{id:'organization_requests',employee_id:'employees'});
    });
  }
  async profileRequest(actor:Actor,body:ProfileRequestDto) {
    return this.addProfileRequest(actor,body.field,body.value);
  }
  async paymentRequest(actor:Actor,body:PaymentDto) {
    return this.addProfileRequest(actor,'payment_details',body);
  }
  private async addProfileRequest(actor:Actor,key:string,value:string|PaymentDto) {
    return this.db.transaction(async tx=>{
      const roles=await this.access.roles(actor,tx);
      const approver=roles.includes('hr')?await this.reviewer(tx,'ceo',actor.employeeId):await this.reviewer(tx,'hr',actor.employeeId);
      const field=await requireRow(tx,`SELECT f.id FROM resource_fields f JOIN access_resources r ON r.id=f.resource_id
        WHERE r.key='employee_profile' AND f.field_key=$1 AND f.status='active'`,[key]);
      const req=await this.submit(tx,actor,actor.employeeId,'profile_change',null,[{employee:approver,kind:'approve'}]);
      await tx.query(`INSERT INTO profile_change_items(request_id,resource_field_id,proposed_value,created_by,updated_by)
        VALUES($1,$2,$3::jsonb,$4,$4)`,[req.id,field.id,JSON.stringify(value),actor.accountId]);
      return publicRow(tx,req,{id:'organization_requests',employee_id:'employees'});
    });
  }
  async employmentRequest(actor:Actor,body:EmploymentRequestDto) {
    return this.db.transaction(async tx=>{
      const e=await requireRow(tx,`SELECT id,employment_status,reporting_boss_id,probation_end_on FROM employees WHERE id=$1`,[body.employeeId]);
      if (!['probation','confirmed'].includes(e.employment_status)) throw new ConflictException('Employee is not active');
      const ceo=await this.reviewer(tx,'ceo',e.id);
      const steps:Step[]=[];
      if (body.type==='resignation') {
        if (actor.employeeId!==e.id) throw new ForbiddenException();
        if (e.reporting_boss_id && e.reporting_boss_id!==ceo) steps.push({employee:e.reporting_boss_id,kind:'recommend'});
        const hr=await this.reviewer(tx,'hr',e.id);
        if (!steps.some(s=>s.employee===hr)) steps.push({employee:hr,kind:'recommend'});
      } else {
        await this.access.require(actor,['hr'],tx);
        if (actor.employeeId===e.id) throw new ForbiddenException();
        if (body.type==='probation') {
          if (e.employment_status!=='probation' || !body.probationOutcome) throw new BadRequestException('A probation outcome is required for an employee on probation');
          steps.push({employee:actor.employeeId,kind:'recommend'});
          if (body.probationOutcome==='extend') {
            const valid=body.proposedProbationEndOn && (await tx.query(`SELECT
              $2::date > $1::date AND $2::date <= $1::date + interval '3 months' AS ok`,
              [e.probation_end_on,body.proposedProbationEndOn])).rows[0].ok;
            if (!valid) throw new BadRequestException('The extension must be at most three months');
          }
        }
      }
      if ((body.type!=='probation' && (body.probationOutcome || body.proposedProbationEndOn)) ||
          (body.type==='probation' && body.probationOutcome!=='extend' && body.proposedProbationEndOn)) {
        throw new BadRequestException('Probation dates apply only to an extension');
      }
      steps.push({employee:ceo,kind:'approve'});
      const req=await this.submit(tx,actor,e.id,body.type,body.reason,steps,body.probationOutcome??null,body.proposedProbationEndOn??null);
      return publicRow(tx,req,{id:'organization_requests',employee_id:'employees'});
    });
  }
  async requests(actor:Actor) {
    const ceo=(await this.access.roles(actor)).includes('ceo');
    const rows=(await this.db.query(`SELECT r.id,r.employee_id,r.request_type,r.request_status,r.submitted_at
      FROM organization_requests r WHERE $1 OR r.employee_id=$2 OR r.requested_by_account_id=$3 OR EXISTS (
        SELECT 1 FROM organization_approval_steps s LEFT JOIN delegations d
        ON d.delegator_employee_id=s.assigned_employee_id AND d.delegate_employee_id=$2 AND d.status='active'
           AND ${localDay} BETWEEN d.starts_on AND d.ends_on AND s.step_kind='recommend'
        WHERE s.request_id=r.id AND (s.assigned_employee_id=$2 OR s.acted_by_account_id=$3 OR d.id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM organization_approval_steps prev WHERE prev.request_id=r.id
            AND prev.step_order<s.step_order AND prev.decision<>'approved'))
      ORDER BY r.submitted_at DESC LIMIT 100`,[ceo,actor.employeeId,actor.accountId])).rows;
    return publicRows(this.db.pool,rows,{id:'organization_requests',employee_id:'employees'});
  }
  async details(actor:Actor,id:string) {
    const ceo=(await this.access.roles(actor)).includes('ceo');
    const req=await requireRow(this.db.pool,`SELECT id,employee_id,request_type,request_status,reason,submitted_at,applied_at,
      notice_sent_on,last_working_on,proposed_probation_end_on,probation_outcome
      FROM organization_requests r WHERE r.id=$1 AND
      ($2::boolean OR r.employee_id=$3 OR r.requested_by_account_id=$4 OR EXISTS (
        SELECT 1 FROM organization_approval_steps s LEFT JOIN delegations d ON d.delegator_employee_id=s.assigned_employee_id
          AND d.delegate_employee_id=$3 AND d.status='active' AND ${localDay} BETWEEN d.starts_on AND d.ends_on
          AND s.step_kind='recommend'
        WHERE s.request_id=r.id AND (s.assigned_employee_id=$3 OR s.acted_by_account_id=$4 OR d.id IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM organization_approval_steps prev WHERE prev.request_id=r.id
            AND prev.step_order<s.step_order AND prev.decision<>'approved')))`,[id,ceo,actor.employeeId,actor.accountId]);
    const roles=(await this.db.query('SELECT r.uuid AS role_id,i.operation FROM role_change_items i JOIN identity.roles r ON r.id=i.role_id WHERE i.request_id=$1',[id])).rows;
    const fields=(await this.db.query(`SELECT f.field_key,i.proposed_value FROM profile_change_items i
      JOIN resource_fields f ON f.id=i.resource_field_id WHERE i.request_id=$1`,[id])).rows;
    const steps=(await this.db.query(`SELECT step_order,assigned_employee_id,step_kind,decision,decided_at,decision_note
      FROM organization_approval_steps WHERE request_id=$1 ORDER BY step_order`,[id])).rows;
        return {...await publicRow(this.db.pool,req,{id:'organization_requests',employee_id:'employees'}),roles,fields:fields.map(field=>field.field_key==='payment_details' ? {
      field_key:field.field_key,
      proposed_value:{
        method:field.proposed_value.method,
        provider:field.proposed_value.provider,
        referenceLastFour:field.proposed_value.accountReference.slice(-4),
      },
    } : field),steps:await publicRows(this.db.pool,steps,{assigned_employee_id:'employees'})};
  }
  async decide(actor:Actor,id:string,body:DecisionDto) {
    await this.db.transaction(async tx=>{
      const req=await requireRow(tx,'SELECT * FROM organization_requests WHERE id=$1 FOR UPDATE',[id]);
      if (req.employee_id===actor.employeeId) throw new ForbiddenException('Self-approval is not allowed');
      if (req.request_status!=='pending') throw new ConflictException('Request is not pending');
      const step=await requireRow(tx,`SELECT * FROM organization_approval_steps WHERE request_id=$1 AND decision='pending'
        ORDER BY step_order LIMIT 1 FOR UPDATE`,[id]);
      let delegate:string|null=null;
      if (step.assigned_employee_id!==actor.employeeId) {
        if (step.step_kind!=='recommend' || req.request_type!=='resignation') throw new ForbiddenException();
        delegate=(await tx.query(`SELECT d.id FROM delegations d JOIN employees e ON e.id=d.delegator_employee_id
          WHERE d.delegator_employee_id=$1 AND d.delegate_employee_id=$2 AND e.reporting_boss_id=$2
            AND d.status='active' AND ${localDay} BETWEEN d.starts_on AND d.ends_on ORDER BY starts_on DESC LIMIT 1`,
          [step.assigned_employee_id,actor.employeeId])).rows[0]?.id??null;
        if (!delegate) throw new ForbiddenException();
      }
      if (step.step_kind==='approve') await this.access.require(actor,req.request_type==='profile_change'?['hr','ceo']:['ceo'],tx);
      if (step.step_kind==='recommend' && ['probation','role_change'].includes(req.request_type)) await this.access.require(actor,['hr'],tx);
      await tx.query(`UPDATE organization_approval_steps SET acted_by_account_id=$2,delegation_id=$3,
        decision=$4,decided_at=now(),decision_note=$5,updated_at=now(),updated_by=$2 WHERE id=$1`,
        [step.id,actor.accountId,delegate,body.decision,body.note??null]);
      await audit(tx,actor.accountId,'organization.step_decided','organization_request',id,{decision:'pending'},
        {decision:body.decision,step:step.step_order,delegationId:delegate},req.employee_id);
      if (body.decision==='rejected') {
        await this.setStatus(tx,id,'rejected',actor.accountId);
        await notify(tx,req.employee_id,id,'request.rejected',actor.accountId);
      } else if (step.step_kind==='approve') {
        await this.setStatus(tx,id,'approved',actor.accountId);
        await notify(tx,req.employee_id,id,'request.approved',actor.accountId);
        if (req.request_type==='profile_change') {
          const change=await requireRow(tx,`SELECT f.field_key,i.proposed_value FROM profile_change_items i
            JOIN resource_fields f ON f.id=i.resource_field_id WHERE i.request_id=$1`,[id]);
          if (change.field_key==='payment_details') {
            await this.employees.applyPayment(tx,actor.accountId,req.employee_id,change.proposed_value);
          } else {
            await this.employees.applyProfile(tx,actor.accountId,req.employee_id,change.field_key,change.proposed_value);
          }
          await this.setStatus(tx,id,'applied',actor.accountId);
        }
      } else {
        const next=await requireRow(tx,`SELECT assigned_employee_id FROM organization_approval_steps
          WHERE request_id=$1 AND decision='pending' ORDER BY step_order LIMIT 1`,[id]);
        await notify(tx,next.assigned_employee_id,id,'approval.pending',actor.accountId);
      }
    });
  }
  private async setStatus(tx:Tx,id:string,status:string,actor:string) {
    await tx.query(`UPDATE organization_requests SET request_status=$2::identity.request_status_value,updated_at=now(),updated_by=$3,
      applied_at=CASE WHEN $2::identity.request_status_value='applied' THEN now() ELSE applied_at END WHERE id=$1`,[id,status,actor]);
  }
  async apply(actor:Actor,id:string,tasksCompleted:boolean) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const req=await requireRow(tx,'SELECT * FROM organization_requests WHERE id=$1 FOR UPDATE',[id]);
      const employee=await requireRow(tx,'SELECT employment_status,probation_end_on FROM employees WHERE id=$1 FOR UPDATE',[req.employee_id]);
      if (req.request_status!=='approved') throw new ConflictException('An approved request is required');
      if (req.request_type==='role_change') {
        if (!tasksCompleted) throw new ConflictException('Confirm that open tasks are completed');
        const items=(await tx.query('SELECT role_id,operation FROM role_change_items WHERE request_id=$1',[id])).rows;
        for (const item of items) {
          if (item.operation==='grant') {
            await requireRow(tx,`SELECT id FROM roles WHERE id=$1 AND status='active'`,[item.role_id]);
            await tx.query(`INSERT INTO role_assignments(employee_id,role_id,source_request_id,valid_from,created_by,updated_by)
              VALUES($1,$2,$3,now(),$4,$4)`,[req.employee_id,item.role_id,id,actor.accountId]);
          } else {
            const result=await tx.query(`UPDATE role_assignments SET valid_to=now(),updated_at=now(),updated_by=$3
              WHERE employee_id=$1 AND role_id=$2 AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())`,
              [req.employee_id,item.role_id,actor.accountId]);
            if (!result.rowCount) throw new ConflictException('No active role assignment exists');
          }
        }
      } else if (req.request_type==='probation') {
        if (employee.employment_status!=='probation') throw new ConflictException('Employee is no longer on probation');
        if (req.probation_outcome==='confirm') {
          await tx.query(`UPDATE employees SET employment_status='confirmed',updated_at=now(),updated_by=$2 WHERE id=$1`,[req.employee_id,actor.accountId]);
        } else if (req.probation_outcome==='extend') {
          const check=(await tx.query(`SELECT $2::date>$1::date AND $2::date<=$1::date+interval '3 months' AS ok`,
            [employee.probation_end_on,req.proposed_probation_end_on])).rows[0];
          if (!check.ok) throw new ConflictException('Probation dates have changed');
          await tx.query('UPDATE employees SET probation_end_on=$2,updated_at=now(),updated_by=$3 WHERE id=$1',
            [req.employee_id,req.proposed_probation_end_on,actor.accountId]);
        } else {
          await tx.query(`UPDATE employees SET employment_status='exit_pending',updated_at=now(),updated_by=$2 WHERE id=$1`,[req.employee_id,actor.accountId]);
        }
      } else if (['resignation','termination'].includes(req.request_type)) {
        if (employee.employment_status==='exited') throw new ConflictException('Employee has already exited');
        const eligible=(await tx.query(`SELECT COALESCE($1::date, CASE WHEN $2='resignation'
          THEN ($3::timestamptz AT TIME ZONE 'Asia/Dhaka')::date + 30 END)<=${localDay} AS ready`,
          [req.last_working_on,req.request_type,req.submitted_at])).rows[0];
        if (!eligible.ready) throw new ConflictException('The notice period has not ended');
        const account=await requireRow(tx,'SELECT id FROM user_accounts WHERE employee_id=$1 FOR UPDATE',[req.employee_id]);
        await tx.query(`UPDATE user_accounts SET account_status='closed',updated_at=now(),updated_by=$2 WHERE id=$1`,[account.id,actor.accountId]);
        await endSessions(tx,account.id,'account_disabled',actor.accountId);
        await cancelOtp(tx,account.id,actor.accountId);
        await tx.query(`UPDATE employees SET employment_status='exited',updated_at=now(),updated_by=$2 WHERE id=$1`,[req.employee_id,actor.accountId]);
        await tx.query(`UPDATE role_assignments SET valid_to=now(),updated_at=now(),updated_by=$2
          WHERE employee_id=$1 AND valid_from<now() AND (valid_to IS NULL OR valid_to>now())`,[req.employee_id,actor.accountId]);
      } else throw new BadRequestException('This request cannot be applied here');
      await this.setStatus(tx,id,'applied',actor.accountId);
      await audit(tx,actor.accountId,'organization.request_applied','organization_request',id,{status:'approved'},{status:'applied'},req.employee_id);
    });
  }
  async notice(actor:Actor,id:string,sentOn:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo','hr'],tx);
      const req=await requireRow(tx,`SELECT r.*,e.employment_status FROM organization_requests r JOIN employees e ON e.id=r.employee_id
        WHERE r.id=$1 FOR UPDATE OF r`,[id]);
      if (req.request_type!=='termination' || req.request_status!=='approved' || req.notice_sent_on) throw new ConflictException('No approved termination awaits notice');
      const days=req.employment_status==='probation'?7:30;
      const result=await tx.query(`UPDATE organization_requests SET notice_sent_on=$2,last_working_on=$2::date+$3::integer,
        updated_at=now(),updated_by=$4 WHERE id=$1 AND $2::date BETWEEN (SELECT (decided_at AT TIME ZONE 'Asia/Dhaka')::date
          FROM organization_approval_steps WHERE request_id=$1 AND step_kind='approve' AND decision='approved') AND ${localDay}`,
        [id,sentOn,days,actor.accountId]);
      if (!result.rowCount) throw new BadRequestException('Notice date must be between approval and today');
      await audit(tx,actor.accountId,'organization.termination_notice','organization_request',id,null,{sentOn,days},req.employee_id);
    });
  }
  async createDelegation(actor:Actor,body:DelegationDto) {
    return this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      if (body.endsOn<body.startsOn) throw new BadRequestException('End date precedes start date');
      const from=await requireRow(tx,'SELECT reporting_boss_id FROM employees WHERE id=$1',[body.delegatorEmployeeId]);
      if (from.reporting_boss_id!==body.delegateEmployeeId) throw new BadRequestException('Approval cover must be the reporting boss');
      const row=(await tx.query(`INSERT INTO delegations(delegator_employee_id,delegate_employee_id,scope,starts_on,ends_on,status,reason,created_by,updated_by)
        VALUES($1,$2,'approvals',$3,$4,'active',$5,$6,$6) RETURNING id,delegator_employee_id,delegate_employee_id,starts_on,ends_on,status`,
        [body.delegatorEmployeeId,body.delegateEmployeeId,body.startsOn,body.endsOn,body.reason,actor.accountId])).rows[0];
      await audit(tx,actor.accountId,'organization.delegation_created','delegation',row.id,null,row,body.delegatorEmployeeId);
      return publicRow(tx,row,{id:'delegations',delegator_employee_id:'employees',delegate_employee_id:'employees'});
    });
  }
  async listDelegations(actor:Actor) {
    const ceo=(await this.access.roles(actor)).includes('ceo');
    const rows=(await this.db.query(`SELECT id,delegator_employee_id,delegate_employee_id,scope,starts_on,ends_on,status
      FROM delegations WHERE $1 OR delegator_employee_id=$2 OR delegate_employee_id=$2 ORDER BY starts_on DESC LIMIT 100`,[ceo,actor.employeeId])).rows;
    return publicRows(this.db.pool,rows,{id:'delegations',delegator_employee_id:'employees',delegate_employee_id:'employees'});
  }
  async archiveDelegation(actor:Actor,id:string) {
    await this.db.transaction(async tx=>{
      await this.access.require(actor,['ceo'],tx);
      const row=await requireRow(tx,`UPDATE identity.delegations SET status='archived',deleted_at=now(),updated_at=now(),updated_by=$2
        WHERE id=$1 AND status='active' AND deleted_at IS NULL RETURNING id,delegator_employee_id`,[id,actor.accountId]);
      await audit(tx,actor.accountId,'organization.delegation_archived','delegation',id,{status:'active'},{status:'archived'},row.delegator_employee_id);
    });
  }
}
