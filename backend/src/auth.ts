import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { audit, Database, type Tx } from './database.js';
import type { ChangePasswordDto, LoginDto } from './dto.js';

export type Actor = { accountId:string; employeeId:string; sessionId:string; mustChange:boolean };
type Claims = { sub:string; sid:string; mode:'access'|'password_change' };
type Connection = { ip?:string; device?:string };
export const Public = () => SetMetadata('public', true);
export const PasswordChangeAllowed = () => SetMetadata('passwordChangeAllowed', true);
export const Current = createParamDecorator((_data:unknown, ctx:ExecutionContext) => ctx.switchToHttp().getRequest<{actor:Actor}>().actor);
const digest = (value:string) => createHash('sha256').update(value).digest('hex');
export const hashPassword = (value:string) => hash(value,{algorithm:Algorithm.Argon2id,memoryCost:19456,timeCost:2,parallelism:1});
const invalid = () => new UnauthorizedException('Invalid credentials or session');

export async function endSessions(tx:Tx, accountId:string, reason:string, actorId:string, except:string|null = null) {
  const {rows} = await tx.query<{id:string}>(`
    UPDATE login_sessions SET session_status='ended', ended_at=now(), end_reason=$2,updated_at=now(),updated_by=$3
    WHERE user_account_id=$1 AND session_status='active' AND ($4::uuid IS NULL OR id<>$4)
    RETURNING id`, [accountId,reason,actorId,except]);
  if (rows.length) await tx.query(`UPDATE refresh_tokens SET revoked_at=now(),updated_at=now(),updated_by=$2
    WHERE session_id=ANY($1::uuid[]) AND revoked_at IS NULL AND consumed_at IS NULL`, [rows.map(r=>r.id),actorId]);
}
@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));
  constructor(private readonly db:Database, private readonly jwt:JwtService) {}
  private async access(accountId:string, sessionId:string, mustChange:boolean) {
    return this.jwt.signAsync({sub:accountId,sid:sessionId,mode:mustChange?'password_change':'access'} satisfies Claims);
  }
  private async tokens(tx:Tx, accountId:string, sessionId:string, mustChange:boolean, previous:string|null = null) {
    const accessToken = await this.access(accountId,sessionId,mustChange);
    let refreshToken: string | undefined;
    if (!mustChange) {
      refreshToken = randomBytes(48).toString('base64url');
      await tx.query(`INSERT INTO refresh_tokens(session_id,replaces_token_id,token_hash,expires_at,created_by,updated_by)
        VALUES($1,$2,$3,now()+interval '7 days',$4,$4)`,[sessionId,previous,digest(refreshToken),accountId]);
    }
    return { accessToken,refreshToken,expiresIn:300,passwordChangeRequired:mustChange };
  }
  async login(body:LoginDto, conn:Connection) {
    const email = body.email.trim().toLowerCase();
    const row = (await this.db.query(`SELECT a.id,a.password_hash FROM user_accounts a
      JOIN employees e ON e.id=a.employee_id WHERE e.email=$1`,[email])).rows[0];
    const matches = await verify(row?.password_hash ?? await this.dummyHash,body.password);
    if (!row || !matches) throw invalid();
    return this.db.transaction(async tx=>{
      const account = (await tx.query(`SELECT id,employee_id,account_status,password_hash,password_change_status
        FROM user_accounts WHERE id=$1 FOR UPDATE`,[row.id])).rows[0];
      if (account?.account_status!=='active' || account.password_hash!==row.password_hash) throw invalid();
      await endSessions(tx,account.id,'replaced',account.id);
      const sessionId = (await tx.query(`INSERT INTO login_sessions(user_account_id,session_status,device_label,source_ip,started_at,last_active_at,created_by,updated_by)
        VALUES($1,'active',$2,$3,now(),now(),$1,$1) RETURNING id`,[account.id,conn.device??null,conn.ip??null])).rows[0].id;
      await audit(tx, account.id,'auth.login','session',sessionId,null,null,account.employee_id,conn);
      return this.tokens(tx,account.id,sessionId,account.password_change_status==='required');
    });
  }
  async refresh(token:string) {
    const hash = digest(token);
    const result = await this.db.transaction(async tx=>{
      const hint=(await tx.query(`SELECT s.user_account_id FROM refresh_tokens r JOIN login_sessions s ON s.id=r.session_id
        WHERE r.token_hash=$1`,[hash])).rows[0];
      if (!hint) return null;
      const account=(await tx.query(`SELECT id,employee_id,account_status,password_change_status
        FROM user_accounts WHERE id=$1 FOR UPDATE`,[hint.user_account_id])).rows[0];
      const row=(await tx.query(`SELECT r.id,r.session_id,r.consumed_at,r.revoked_at,r.expires_at>now() AS fresh,
        s.session_status,s.last_active_at>now()-interval '30 minutes' AS awake
        FROM refresh_tokens r JOIN login_sessions s ON s.id=r.session_id WHERE r.token_hash=$1`,[hash])).rows[0];
      if (!row || row.session_status!=='active' || account.account_status!=='active') return null;
      if (row.consumed_at) {
        await endSessions(tx,account.id,'security_revoked',account.id);
        await audit(tx,account.id,'auth.refresh_reuse','session',row.session_id,null,null,account.employee_id);
        return null;
      }
      if (!row.fresh || row.revoked_at || !row.awake || account.password_change_status==='required') return null;
      await tx.query('UPDATE refresh_tokens SET consumed_at=now(),updated_at=now(),updated_by=$2 WHERE id=$1',[row.id,account.id]);
      // Refresh is background traffic. API use, not refresh, extends the idle timer.
      return this.tokens(tx,account.id,row.session_id,false,row.id);
    });
    if (!result) throw invalid();
    return result;
  }
  async actor(token:string):Promise<Actor> {
    let claims:Claims;
    try { claims=await this.jwt.verifyAsync<Claims>(token); } catch { throw invalid(); }
    if (typeof claims.sub!=='string' || typeof claims.sid!=='string' || !['access','password_change'].includes(claims.mode)) throw invalid();
    const row=(await this.db.query(`
      UPDATE login_sessions s SET last_active_at=now(),updated_at=now(),updated_by=a.id
      FROM user_accounts a WHERE s.id=$1 AND a.id=$2 AND s.user_account_id=a.id
        AND a.account_status='active' AND s.session_status='active'
        AND s.last_active_at>now()-interval '30 minutes'
        AND ($3='access' AND a.password_change_status='current'
          OR $3='password_change' AND a.password_change_status='required')
      RETURNING a.id,a.employee_id,a.password_change_status`,[claims.sid,claims.sub,claims.mode])).rows[0];
    if (!row) throw invalid();
    return {accountId:row.id,employeeId:row.employee_id,sessionId:claims.sid,mustChange:claims.mode==='password_change'};
  }
  async changePassword(actor:Actor, body:ChangePasswordDto) {
    const existing=(await this.db.query('SELECT password_hash FROM user_accounts WHERE id=$1',[actor.accountId])).rows[0]?.password_hash;
    if (!existing || !await verify(existing,body.currentPassword)) throw invalid();
    if (body.currentPassword===body.password) throw new ForbiddenException('Choose a different password');
    const next=await hashPassword(body.password);
    return this.db.transaction(async tx=>{
      const account=(await tx.query('SELECT password_hash FROM user_accounts WHERE id=$1 FOR UPDATE',[actor.accountId])).rows[0];
      if (account?.password_hash!==existing) throw invalid();
      const session=(await tx.query(`SELECT id FROM login_sessions WHERE id=$1 AND session_status='active'`,[actor.sessionId])).rows[0];
      if (!session) throw invalid();
      await tx.query(`UPDATE user_accounts SET password_hash=$2,password_change_status='current',
        password_changed_at=now(),updated_at=now(),updated_by=$1 WHERE id=$1`,[actor.accountId,next]);
      await endSessions(tx,actor.accountId,'password_reset',actor.accountId,actor.sessionId);
      await tx.query(`UPDATE refresh_tokens SET revoked_at=now(),updated_at=now(),updated_by=$2
        WHERE session_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`,[actor.sessionId,actor.accountId]);
      await audit(tx,actor.accountId,'auth.password_changed','account',actor.accountId,null,null,actor.employeeId);
      return this.tokens(tx,actor.accountId,actor.sessionId,false);
    });
  }
  async logout(actor:Actor) {
    await this.db.transaction(async tx=>{
      await tx.query('SELECT id FROM user_accounts WHERE id=$1 FOR UPDATE',[actor.accountId]);
      const active=(await tx.query(`SELECT id FROM login_sessions WHERE id=$1 AND session_status='active'`,[actor.sessionId])).rows[0];
      if (active) {
        await endSessions(tx,actor.accountId,'logout',actor.accountId);
        await audit(tx,actor.accountId,'auth.logout','session',actor.sessionId,null,null,actor.employeeId);
      }
    });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflect:Reflector,private readonly auth:AuthService) {}
  async canActivate(ctx:ExecutionContext) {
    if (this.reflect.get<boolean>('public',ctx.getHandler())) return true;
    const req=ctx.switchToHttp().getRequest<{headers:{authorization?:string};actor?:Actor}>();
    const [,token]=/^Bearer ([^ ]+)$/i.exec(req.headers.authorization??'')??[];
    if (!token) throw invalid();
    req.actor=await this.auth.actor(token);
    if (req.actor.mustChange && !this.reflect.get<boolean>('passwordChangeAllowed',ctx.getHandler())) {
      throw new ForbiddenException('Change the temporary password first');
    }
    return true;
  }
}
