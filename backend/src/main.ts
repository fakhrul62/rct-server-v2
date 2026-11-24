import 'reflect-metadata';
import { ArgumentsHost, BadRequestException, Catch, ConflictException, HttpException, InternalServerErrorException, Logger, ValidationPipe } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module.js';

@Catch()
class ApiErrors extends BaseExceptionFilter {
  private readonly logger=new Logger(ApiErrors.name);
  override catch(error:unknown, host:ArgumentsHost) {
    if (error instanceof HttpException) return super.catch(error,host);
    const code=(error as {code?:string})?.code;
    if ((error as {statusCode?:number})?.statusCode===429) return super.catch(new HttpException('Too many requests',429),host);
    if (code==='FST_REQ_FILE_TOO_LARGE') return super.catch(new HttpException('File must be at most 5 MiB',413),host);
    if (code?.startsWith('FST_')) return super.catch(new BadRequestException('Invalid upload or request'),host);
    if (code==='23505'||code==='23P01') return super.catch(new ConflictException('Record already exists or overlaps an active record'),host);
    if (['22007','22008','22P02','23502','23503','23514'].includes(code??'')) {
      return super.catch(new BadRequestException('The data violates a database rule'),host);
    }
    this.logger.error(error instanceof Error?[error.name,code].filter(Boolean).join(' '):'Unexpected error', error instanceof Error?error.stack?.split('\n').slice(1).join('\n'):undefined);
    return super.catch(new InternalServerErrorException(),host);
  }
}
const app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({bodyLimit:256*1024}));
const fastify=app.getHttpAdapter().getInstance();
await fastify.register(multipart,{limits:{files:1,fields:1,parts:2,fileSize:5*1024*1024}});
await fastify.register(rateLimit,{timeWindow:'1 minute',
  max:request=>request.url.split('?')[0]==='/api/auth/login'?10:180,
  keyGenerator:request=>request.ip+(request.url.split('?')[0]==='/api/auth/login'?':login':':api'),
});
fastify.addHook('onSend',async (req,res)=>{
  if (req.url.startsWith('/api/')) res.header('Cache-Control','no-store');
});
app.setGlobalPrefix('api');
app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
app.useGlobalFilters(new ApiErrors(app.get(HttpAdapterHost).httpAdapter));
app.enableShutdownHooks();
const config=new DocumentBuilder().setTitle('RCT ERP User Management').setVersion('1.0')
  .setDescription('Employee onboarding, bearer authentication, organization approvals, and role-based access.')
  .addBearerAuth().build();
SwaggerModule.setup('docs',app,SwaggerModule.createDocument(app,config),{jsonDocumentUrl:'docs/openapi.json'});
await app.listen(Number(process.env.PORT??3001),process.env.HOST??'0.0.0.0');
