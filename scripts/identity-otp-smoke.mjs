import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const database = process.env.DATABASE_URL;
const email = process.env.SMOKE_CEO_EMAIL;
const password = process.env.SMOKE_CEO_PASSWORD;
if (!database || !email || !password) throw new Error('Point DATABASE_URL at a disposable database and supply its seeded CEO credentials.');
const delivered=[];
const smtp=createServer(socket=>{
  socket.setEncoding('utf8');
  let pending='';
  let data=null;
  socket.write('220 fixture ESMTP\r\n');
  socket.on('data',chunk=>{
    pending+=chunk;
    while (pending.includes('\r\n')) {
      const end=pending.indexOf('\r\n');
      const line=pending.slice(0,end);
      pending=pending.slice(end+2);
      if (data!==null) {
        if (line!=='.') { data.push(line); continue; }
        delivered.push(data.join('\n').match(/code is ([0-9]{6})\./)?.[1]);
        data=null;
        socket.write('250 Delivered to test inbox\r\n');
      } else if (/^(EHLO|HELO) /i.test(line)) socket.write('250 fixture\r\n');
      else if (/^DATA$/i.test(line)) { data=[]; socket.write('354 End with dot\r\n'); }
      else if (/^QUIT$/i.test(line)) socket.end('221 Bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
smtp.listen(0,'127.0.0.1');
await once(smtp,'listening');
const port=Number(process.env.SMOKE_API_PORT || 33023);
const backend=fileURLToPath(new URL('../backend/',import.meta.url));
const child=spawn(process.execPath,['dist/main.js'],{
  cwd:backend,windowsHide:true,stdio:['ignore','ignore','inherit'],env:{
    ...process.env,DATABASE_URL:database,JWT_SECRET:randomBytes(48).toString('hex'),PORT:String(port),HOST:'127.0.0.1',
    OTP_ENABLED:'true',OTP_SMTP_URL:'smtp://127.0.0.1:'+smtp.address().port,OTP_FROM:'noreply@example.test',
    OTP_PEPPER:randomBytes(48).toString('hex'),
  },
});
let checked=0;
const base='http://127.0.0.1:'+port;
async function post(path,body,status) {
  const res=await fetch(base+'/api/auth'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const result=await res.json();
  assert.equal(res.status,status,path+' expected '+status+' got '+res.status);
  checked++;
  return result;
}
try {
  let healthy=false;
  for (let probe=0;probe<40;probe++) {
    try { if ((await fetch(base+'/api/health')).ok) {healthy=true;break;} } catch {}
    await new Promise(r=>setTimeout(r,150));
  }
  assert.ok(healthy,'OTP test API did not start');
  const challenge=await post('/login',{email,password},200);
  assert.equal(challenge.otpRequired,true);
  assert.equal(challenge.accessToken,undefined);
  assert.match(challenge.challengeId,/^[a-f0-9-]{36}$/i);
  assert.match(delivered.at(-1),/^[0-9]{6}$/);
  assert.ok(!JSON.stringify(challenge).includes('"code"'));
  const code=delivered.at(-1);
  const wrong=code==='000000'?'000001':'000000';
  await post('/otp/verify',{challengeId:challenge.challengeId,code:wrong},401);
  const tokens=await post('/otp/verify',{challengeId:challenge.challengeId,code},200);
  assert.ok(tokens.accessToken);
  await post('/otp/verify',{challengeId:challenge.challengeId,code},401);
  const limited=await post('/login',{email,password},200);
  const correct=delivered.at(-1);
  for (let i=0;i<5;i++) await post('/otp/verify',{challengeId:limited.challengeId,code:correct==='000000'?'000001':'000000'},401);
  await post('/otp/verify',{challengeId:limited.challengeId,code:correct},401);
  console.log(checked+' OTP HTTP checks passed using a local SMTP fixture');
} finally {
  child.kill();
  smtp.close();
}
