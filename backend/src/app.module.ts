import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Access } from './access.js';
import { AuthGuard, AuthService } from './auth.js';
import { AccessController, AuditController, AuthController, EmployeesController, HealthController, NotificationsController, ShiftsController, WorkflowController } from './controllers.js';
import { Database } from './database.js';
import { Employees } from './employees.js';
import { RoleManagement } from './roles.js';
import { Workflow } from './workflow.js';
import { Notifications } from './notifications.js';

@Module({
  imports:[JwtModule.registerAsync({useFactory:()=>{
    const secret=process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret)<32) throw new Error('Set JWT_SECRET to a random secret of at least 32 bytes');
    return {secret,signOptions:{algorithm:'HS256',expiresIn:300,issuer:'rct-erp',audience:'rct-api'},
      verifyOptions:{algorithms:['HS256'],issuer:'rct-erp',audience:'rct-api'}};
  }})],
  controllers:[AuthController,EmployeesController,ShiftsController,AccessController,WorkflowController,AuditController,HealthController,NotificationsController],
  providers:[Database,AuthService,Access,Employees,RoleManagement,Workflow,Notifications,{provide:APP_GUARD,useClass:AuthGuard}],
})
export class AppModule {}
