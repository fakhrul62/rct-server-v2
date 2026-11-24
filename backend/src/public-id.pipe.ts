import { ArgumentMetadata, Injectable, mixin, Param, ParseUUIDPipe, type PipeTransform } from '@nestjs/common';
import { Database } from './database.js';
import { ActivateDto, AssignShiftDto, BossDto, DelegationDto, EmploymentRequestDto, FieldPolicyDto, GrantDto, RoleRequestDto } from './dto.js';
import { internalId, type IdentityTable } from './public-ids.js';

export function PublicId(table:IdentityTable, name='id') {
  @Injectable()
  class ResolveId implements PipeTransform<string,Promise<string>> {
    constructor(private readonly db:Database) {}
    transform(value:string) { return internalId(this.db.pool,table,value); }
  }
  return Param(name,new ParseUUIDPipe(),mixin(ResolveId));
}
const mappings=new Map<Function,Record<string,IdentityTable>>([
  [ActivateDto,{ roleId:'roles',reportingBossId:'employees' }],
  [AssignShiftDto,{ shiftId:'shifts' }],
  [BossDto,{ reportingBossId:'employees' }],
  [DelegationDto,{ delegatorEmployeeId:'employees',delegateEmployeeId:'employees' }],
  [EmploymentRequestDto,{ employeeId:'employees' }],
  [FieldPolicyDto,{ resourceFieldId:'resource_fields' }],
  [GrantDto,{ permissionId:'permissions' }],
  [RoleRequestDto,{ employeeId:'employees',roleId:'roles' }],
]);
@Injectable()
export class PublicBodyIds implements PipeTransform {
  constructor(private readonly db:Database) {}
  async transform(value:Record<string,string>,metadata:ArgumentMetadata) {
    if (metadata.type!=='body' || !metadata.metatype) return value;
    const fields=mappings.get(metadata.metatype);
    if (!fields) return value;
    for (const [key,table] of Object.entries(fields)) value[key]=await internalId(this.db.pool,table,value[key]);
    return value;
  }
}
