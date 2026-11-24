import { applyDecorators, BadRequestException, Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Patch, Post, Put, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiCreatedResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiPropertyOptional, ApiResponse, ApiTags, ApiUnauthorizedResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Access } from './access.js';
import { AuthService, Current, PasswordChangeAllowed, Public, type Actor } from './auth.js';
import { Database } from './database.js';
import {
  AccountStatusDto, ActivateDto, ApplyRoleDto, AssignShiftDto, BossDto, ChangePasswordDto, DecisionDto, DelegationDto,
  EmployeeDto, EmploymentRequestDto, FieldPolicyDto, GrantDto, LoginDto, NoticeDto, PasswordDto, PaymentDto,
  ProfileRequestDto, RefreshDto, RoleDto, RoleRequestDto, RoleUpdateDto, SalaryDto, ShiftDto, VerifyOtpDto,
} from './dto.js';
import { Employees } from './employees.js';
import { RoleManagement } from './roles.js';
import { Workflow } from './workflow.js';
import { Notifications } from './notifications.js';
import { documentTypes, employeeFile, type EmployeeFile } from './employee-file.js';

import { PublicId } from './public-id.pipe.js';
import { publicRows } from './public-ids.js';
const Op = (summary:string)=>applyDecorators(ApiOperation({summary}),ApiOkResponse(),ApiResponse({status:400,description:'Invalid input'}),ApiResponse({status:404,description:'Record not found or not visible'}),ApiResponse({status:409,description:'Record conflicts with the requested change'}));
const Create = (summary:string)=>applyDecorators(ApiOperation({summary}),ApiCreatedResponse(),ApiResponse({status:400,description:'Invalid input'}),ApiResponse({status:409,description:'Record conflicts with the requested change'}));
const Protected = ()=>applyDecorators(ApiBearerAuth(),ApiUnauthorizedResponse({description:'Missing, expired, or revoked access token'}),ApiForbiddenResponse({description:'Insufficient permission or password change required'}));
class TokensResponse {
  @ApiProperty() accessToken!:string;
  @ApiPropertyOptional() refreshToken?:string;
  @ApiProperty() expiresIn!:number;
  @ApiProperty() passwordChangeRequired!:boolean;
}

class OtpChallengeResponse {
  @ApiProperty({enum:[true]}) otpRequired!:true;
  @ApiProperty({format:'uuid'}) challengeId!:string;
  @ApiProperty({example:180}) expiresIn!:number;
}

@ApiTags('Authentication')
@ApiExtraModels(TokensResponse,OtpChallengeResponse)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth:AuthService,private readonly access:Access) {}
  @Public() @Post('login') @HttpCode(200)
  @ApiOperation({summary:'Sign in and replace the previous device session'})
  @ApiOkResponse({schema:{oneOf:[{$ref:getSchemaPath(TokensResponse)},{$ref:getSchemaPath(OtpChallengeResponse)}]}}) @ApiUnauthorizedResponse()
  login(@Body() body:LoginDto,@Req() request:FastifyRequest) {
    return this.auth.login(body,{ip:request.ip,device:request.headers['user-agent']?.slice(0,300)});
  }
  @Public() @Post('otp/verify') @HttpCode(200)
  @ApiOperation({summary:'Verify a sign-in OTP and start a session when OTP is enabled'})
  @ApiOkResponse({type:TokensResponse}) @ApiUnauthorizedResponse()
  otp(@Body() body:VerifyOtpDto,@Req() request:FastifyRequest) {
    return this.auth.verifyOtp(body.challengeId,body.code,{ip:request.ip,device:request.headers['user-agent']?.slice(0,300)});
  }
  @Public() @Post('refresh') @HttpCode(200)
  @ApiOperation({summary:'Rotate a refresh token and issue a new access token'})
  @ApiOkResponse({type:TokensResponse}) @ApiUnauthorizedResponse()
  refresh(@Body() body:RefreshDto) { return this.auth.refresh(body.refreshToken); }
  @Protected() @PasswordChangeAllowed() @Post('change-password') @HttpCode(200)
  @ApiOperation({summary:'Change a temporary or current password'})
  @ApiOkResponse({type:TokensResponse})
  change(@Current() a:Actor,@Body() b:ChangePasswordDto) { return this.auth.changePassword(a,b); }
  @Protected() @PasswordChangeAllowed() @Post('logout') @HttpCode(204)
  @ApiOperation({summary:'End the current session and revoke its refresh token'})
  @ApiResponse({status:204})
  logout(@Current() a:Actor) { return this.auth.logout(a); }
  @Protected() @Get('me') @Op('Get the current employee and active role keys')
  async me(@Current() a:Actor) { return { employeeId:a.employeeUuid,roles:await this.access.roles(a) }; }
}

@ApiTags('Employees') @Protected()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service:Employees) {}
  @Get() @Op('List employee profiles visible to the caller')
  list(@Current() a:Actor,@Query('offset',new DefaultValuePipe(0),ParseIntPipe) offset:number) {
    return this.service.list(a,Math.max(0,Math.min(offset,10000)));
  }
  @Get('org-chart') @Op('View the reporting structure without private profile fields')
  orgChart(@Current() a:Actor) { return this.service.orgChart(a); }
  @Post() @Create('Create an employee and inactive account with a temporary password')
  create(@Current() a:Actor,@Body() b:EmployeeDto) { return this.service.add(a,b); }
  @Get(':id') @Op('Read an employee profile filtered by field policy')
  find(@Current() a:Actor,@PublicId('employees') id:string) { return this.service.read(a,id); }
  @Post(':id/activate') @HttpCode(204) @ApiOperation({summary:'Assign the first role and boss and activate the employee account'}) @ApiResponse({status:204})
  activate(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:ActivateDto) { return this.service.activate(a,id,b); }
  @Post(':id/reset-password') @HttpCode(204) @ApiOperation({summary:'Issue a temporary password and revoke existing sessions'}) @ApiResponse({status:204})
  reset(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:PasswordDto) { return this.service.resetPassword(a,id,b.password); }
  @Patch(':id/account-status') @Op('Suspend or reactivate an employee login as CEO')
  accountStatus(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:AccountStatusDto) { return this.service.accountStatus(a,id,b.status); }
  @Patch(':id/documents/:documentId/archive') @Op('Archive an employee document')
  archiveDocument(@Current() a:Actor,@PublicId('employees') id:string,@PublicId('employee_documents','documentId') doc:string) { return this.service.archiveDocument(a,id,doc); }
  @Patch(':id/boss') @Op('Change the reporting boss')
  boss(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:BossDto) { return this.service.changeBoss(a,id,b.reportingBossId); }
  @Patch(':id/salary') @Op('Set gross salary as CEO')
  salary(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:SalaryDto) { return this.service.setSalary(a,id,b.grossSalary); }
  @Patch(':id/profile') @Op('Update one editable field within the caller’s record scope')
  profile(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:ProfileRequestDto) { return this.service.editProfile(a,id,b.field,b.value); }
  @Patch(':id/shift') @Op('Assign an existing active shift')
  shift(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:AssignShiftDto) { return this.service.assignShift(a,id,b.shiftId); }
  @Get(':id/documents') @Op('List permitted employee document metadata')
  documents(@Current() a:Actor,@PublicId('employees') id:string) { return this.service.documents(a,id); }
  @Post(':id/documents') @Create('Upload an employee document')
  @ApiConsumes('multipart/form-data')
  @ApiBody({schema:{type:'object',required:['type','file'],properties:{
    type:{type:'string',enum:documentTypes},file:{type:'string',format:'binary'},
  }}})
  async document(@Current() a:Actor,@PublicId('employees') id:string,@Req() request:FastifyRequest) {
    await this.service.authorizeDocumentUpload(a);
    if (!request.isMultipart()) throw new BadRequestException('Use multipart/form-data');
    let type:string|undefined;
    let file:EmployeeFile|undefined;
    for await (const part of request.parts()) {
      if (part.type==='file' && part.fieldname==='file') {
        file=employeeFile(part.filename,await part.toBuffer());
      } else if (part.type==='field' && part.fieldname==='type' && typeof part.value==='string') {
        type=part.value;
      } else throw new BadRequestException('Expected a type and file');
    }
    if (!type || !file) throw new BadRequestException('Expected a type and file');
    return this.service.addDocument(a,id,type,file);
  }
  @Get(':id/documents/:documentId') @ApiOperation({summary:'Download an authorized employee document'})
  @ApiOkResponse({content:{'application/octet-stream':{schema:{type:'string',format:'binary'}}}})
  async download(@Current() a:Actor,@PublicId('employees') id:string,@PublicId('employee_documents','documentId') doc:string,@Res({passthrough:true}) res:FastifyReply) {
    const file=await this.service.downloadDocument(a,id,doc);
    const extension=file.content_type==='application/pdf'?'pdf':file.content_type==='image/png'?'png':'jpg';
    res.header('X-Content-Type-Options','nosniff');
    return new StreamableFile(file.content_bytes,{type:'application/octet-stream',disposition:'attachment; filename="document.'+extension+'"'});
  }
  @Get(':id/payment-details') @Op('Read masked payment details')
  payment(@Current() a:Actor,@PublicId('employees') id:string) { return this.service.payment(a,id); }
  @Put(':id/payment-details') @Op('Set employee payment details as CEO')
  updatePayment(@Current() a:Actor,@PublicId('employees') id:string,@Body() b:PaymentDto) { return this.service.updatePayment(a,id,b); }
}
@ApiTags('Shifts') @Protected()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly employees:Employees) {}
  @Get() @Op('List shifts') list() { return this.employees.listShifts(); }
  @Post() @Create('Create a shift as CEO') add(@Current() a:Actor,@Body() b:ShiftDto) { return this.employees.createShift(a,b); }
}
@ApiTags('Roles and field policies') @Protected()
@Controller('access')
export class AccessController {
  constructor(private readonly roles:RoleManagement) {}
  @Get('roles') @Op('List role definitions') list() { return this.roles.list(); }
  @Get('catalog') @Op('List permissions and individual field keys as CEO') catalog(@Current() a:Actor) { return this.roles.catalog(a); }
  @Get('roles/:id/grants') @Op('List grants and active field policies for one role')
  grants(@Current() a:Actor,@PublicId('roles') id:string) { return this.roles.grants(a,id); }
  @Post('roles') @Create('Create a custom role')
  add(@Current() a:Actor,@Body() b:RoleDto) { return this.roles.create(a,b); }
  @Patch('roles/:id') @Op('Update role details using the current version')
  update(@Current() a:Actor,@PublicId('roles') id:string,@Body() b:RoleUpdateDto) { return this.roles.update(a,id,b); }
  @Patch('roles/:id/archive') @Op('Archive a custom role')
  archive(@Current() a:Actor,@PublicId('roles') id:string) { return this.roles.archive(a,id); }
  @Post('roles/:id/grants') @Create('Grant a permission with employee record scope')
  grant(@Current() a:Actor,@PublicId('roles') id:string,@Body() b:GrantDto) { return this.roles.grant(a,id,b); }
  @Patch('grants/:id/revoke') @Op('Revoke a permission grant and retain history')
  revoke(@Current() a:Actor,@PublicId('role_permissions') id:string) { return this.roles.revoke(a,id); }
  @Put('grants/:id/field-policies') @Op('Set access to one field for a grant')
  policy(@Current() a:Actor,@PublicId('role_permissions') id:string,@Body() b:FieldPolicyDto) { return this.roles.fieldPolicy(a,id,b); }
}
@ApiTags('Organization approvals') @Protected()
@Controller('organization')
export class WorkflowController {
  constructor(private readonly workflow:Workflow) {}
  @Get('requests') @Op('List requests visible to the caller')
  list(@Current() a:Actor) { return this.workflow.requests(a); }
  @Get('requests/:id') @Op('View a request and approval steps')
  details(@Current() a:Actor,@PublicId('organization_requests') id:string) { return this.workflow.details(a,id); }
  @Post('requests/role-change') @Create('Request an employee role grant or removal')
  role(@Current() a:Actor,@Body() b:RoleRequestDto) { return this.workflow.roleRequest(a,b); }
  @Post('requests/profile-change') @Create('Request a change to an allowed personal field')
  profile(@Current() a:Actor,@Body() b:ProfileRequestDto) { return this.workflow.profileRequest(a,b); }
  @Post('requests/payment-change') @Create('Request an HR-approved payout details change')
  payment(@Current() a:Actor,@Body() b:PaymentDto) { return this.workflow.paymentRequest(a,b); }
  @Post('requests/employment') @Create('Submit a probation, resignation or termination request')
  employment(@Current() a:Actor,@Body() b:EmploymentRequestDto) { return this.workflow.employmentRequest(a,b); }
  @Patch('requests/:id/decision') @Op('Decide the next pending approval step')
  decide(@Current() a:Actor,@PublicId('organization_requests') id:string,@Body() b:DecisionDto) { return this.workflow.decide(a,id,b); }
  @Patch('requests/:id/apply') @Op('Apply an approved request as CEO')
  apply(@Current() a:Actor,@PublicId('organization_requests') id:string,@Body() b:ApplyRoleDto) { return this.workflow.apply(a,id,b.openTasksCompleted); }
  @Patch('requests/:id/notice') @Op('Record delivery of an approved termination notice')
  notice(@Current() a:Actor,@PublicId('organization_requests') id:string,@Body() b:NoticeDto) { return this.workflow.notice(a,id,b.noticeSentOn); }
  @Get('delegations') @Op('List visible temporary approval coverage')
  delegations(@Current() a:Actor) { return this.workflow.listDelegations(a); }
  @Post('delegations') @Create('Record time-limited approval cover as CEO')
  delegation(@Current() a:Actor,@Body() b:DelegationDto) { return this.workflow.createDelegation(a,b); }
  @Patch('delegations/:id/archive') @Op('End delegation and retain the record')
  archive(@Current() a:Actor,@PublicId('delegations') id:string) { return this.workflow.archiveDelegation(a,id); }
}
@ApiTags('Audit') @Protected()
@Controller('audit')
export class AuditController {
  constructor(private readonly db:Database,private readonly access:Access) {}
  @Get() @Op('Read the audit log as CEO')
  async list(@Current() a:Actor,@Query('offset',new DefaultValuePipe(0),ParseIntPipe) offset:number) {
    await this.access.require(a,['ceo']);
    const rows=(await this.db.query(`SELECT id,actor_account_id,subject_employee_id,action_key,resource_key,record_id,
      occurred_at,before_values,after_values,source_ip,device_label
      FROM audit_events ORDER BY occurred_at DESC,id DESC LIMIT 50 OFFSET $1`,[Math.max(0,Math.min(offset,10000))])).rows;
    return publicRows(this.db.pool,rows,{id:'audit_events',actor_account_id:'user_accounts',subject_employee_id:'employees'});
  }
}
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly db:Database) {}
  @Public() @Get() @Op('Check API and database connectivity')
  async check() { await this.db.query('SELECT 1');return { status:'ok' }; }
}

@ApiTags('Notifications') @Protected()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications:Notifications) {}
  @Get() @Op('List the current employeeÃ¢â‚¬â„¢s workflow notifications')
  list(@Current() actor:Actor) { return this.notifications.list(actor); }
  @Patch(':id/read') @Op('Mark a notification as read')
  read(@Current() actor:Actor,@PublicId('identity_notifications') id:string) { return this.notifications.read(actor,id); }
}
