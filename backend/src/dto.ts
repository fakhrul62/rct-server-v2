import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';

const Text = (max = 200) => applyDecorators(ApiProperty({ type: String, maxLength: max }), IsString(), IsNotEmpty(), Length(1,max));
const OptionalText = (max = 200) => applyDecorators(ApiPropertyOptional({ type: String, maxLength: max }), ValidateIf((_o,v)=>v!==undefined), IsString(), Length(1,max));
const Uuid = () => applyDecorators(ApiProperty({ format:'uuid' }), IsUUID());
const OptionalUuid = () => applyDecorators(ApiPropertyOptional({ format:'uuid' }), ValidateIf((_o,v)=>v!==undefined), IsUUID());
const Choice = (values: string[]) => applyDecorators(ApiProperty({ enum:values }), IsIn(values));
const Day = () => applyDecorators(ApiProperty({ format:'date' }), IsDateString({ strict:true }), Length(10,10));
const OptionalDay = () => applyDecorators(ApiPropertyOptional({ format:'date' }), ValidateIf((_o,v)=>v!==undefined), IsDateString({ strict:true }), Length(10,10));
const Email = () => applyDecorators(ApiProperty({ format:'email' }), IsEmail(), Length(3,254));
const Password = () => applyDecorators(ApiProperty({ type:String, format:'password',minLength:12,maxLength:128 }), IsString(), Length(12,128));

export class LoginDto { @Email() email!:string; @Password() password!:string; }
export class RefreshDto { @Text(128) refreshToken!:string; }
export class PasswordDto { @Password() password!:string; }
export class ChangePasswordDto extends PasswordDto { @Password() currentPassword!:string; }
export class EmployeeDto {
  @Text() name!:string; @Email() email!:string;
  @Day() joinedOn!:string; @Password() temporaryPassword!:string;
  @OptionalDay() probationEndOn?:string;
  @OptionalText(40) phone?:string; @OptionalText(500) address?:string; @OptionalText(50) nid?:string;
  @OptionalDay() birthDate?:string; @OptionalText(512) photoRef?:string;
  @OptionalText(120) emergencyContactName?:string; @OptionalText(40) emergencyContactPhone?:string;
  @ApiPropertyOptional({enum:['web_developer','digital_marketer','video_editor']}) @IsOptional()
  @IsIn(['web_developer','digital_marketer','video_editor']) executorSubtype?:string;
}
export class ActivateDto { @Uuid() roleId!:string; @Uuid() reportingBossId!:string; }
export class ShiftDto { @Text(40) code!:string; @Text() name!:string; @Text(8) startsAt!:string; @Text(8) endsAt!:string; }
export class AssignShiftDto { @Uuid() shiftId!:string; }
export class BossDto { @Uuid() reportingBossId!:string; }
export class SalaryDto {
  @ApiProperty({minimum:0}) @IsNumber({maxDecimalPlaces:2}) @Min(0) @Max(1_000_000_000)
  grossSalary!:number;
}

export class RoleDto { @Text(70) key!:string; @Text(120) name!:string; @Text(500) description!:string; }
export class GrantDto { @Uuid() permissionId!:string; @Choice(['own','all']) scope!:string; }
export class FieldPolicyDto { @Uuid() resourceFieldId!:string; @Choice(['none','read','write']) access!:string; }
export class DelegationDto { @Uuid() delegatorEmployeeId!:string; @Uuid() delegateEmployeeId!:string; @Day() startsOn!:string; @Day() endsOn!:string; @Text(500) reason!:string; }
export class RoleRequestDto { @Uuid() employeeId!:string; @Uuid() roleId!:string; @Choice(['grant','end_grant']) operation!:string; @Text(500) reason!:string; }
export class ProfileRequestDto {
  @Choice(['phone','address','emergency_contact_name','emergency_contact_phone']) field!:string;
  @Text(500) value!:string;
}
export class EmploymentRequestDto {
  @Uuid() employeeId!:string;
  @Choice(['probation','resignation','termination']) type!:string;
  @Text(500) reason!:string;
  @ApiPropertyOptional({enum:['confirm','extend','exit']}) @ValidateIf((_o,v)=>v!==undefined)
  @IsIn(['confirm','extend','exit']) probationOutcome?:string;
  @OptionalDay() proposedProbationEndOn?:string;
}
export class DecisionDto { @Choice(['approved','rejected']) decision!:string; @OptionalText(500) note?:string; }
export class ApplyRoleDto {
  @ApiProperty({description:'CEO confirms the employee has completed their open tasks'}) @IsBoolean()
  openTasksCompleted!:boolean;
}
export class NoticeDto { @Day() noticeSentOn!:string; }
export class PaymentDto {
  @Choice(['bank','mobile_banking']) method!:string;
  @Text(120) provider!:string; @Text(160) accountReference!:string;
  @OptionalText(120) accountHolder?:string;
}

export class AccountStatusDto { @Choice(['active','suspended']) status!:'active'|'suspended'; }
export class RoleUpdateDto {
  @Text(120) name!:string;
  @Text(500) description!:string;
  @ApiProperty({type:'integer',minimum:1}) @IsInt() @Min(1) version!:number;
}
