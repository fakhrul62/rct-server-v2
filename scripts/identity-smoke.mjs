import assert from 'node:assert/strict';

const base = process.env.SMOKE_URL;
const email = process.env.SMOKE_CEO_EMAIL;
const temp = process.env.SMOKE_CEO_PASSWORD;
if (!base || !email || !temp) throw new Error('Set SMOKE_URL and the initial CEO credentials for a disposable database.');
const suffix = Date.now().toString(36);
const password = 'Smoke-Permanent-'+suffix+'!';
const starter = 'Smoke-Temporary-'+suffix+'!';
let checked = 0;
async function call(method, path, status, body, token) {
  const headers = {};
  if (token) headers.authorization = 'Bearer '+token;
  if (body !== undefined && !(body instanceof FormData)) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(base+path,{method, headers, body});
  const text = await res.text();
  assert.equal(res.status,status,method+' '+path+' '+(res.status===status?'':text.slice(0,300)));
  checked++;
  return text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
}
const api=(...args)=>call(args[0],'/api'+args[1],...args.slice(2));
const doc=await call('GET','/docs/openapi.json',200);
assert.ok(doc.paths['/api/auth/login'].post.requestBody);
assert.ok(doc.paths['/api/employees/{id}/documents'].post.requestBody.content['multipart/form-data']);
await call('GET','/docs',200);
await api('GET','/health',200);
await api('GET','/employees',401);
const first=await api('POST','/auth/login',200,{email,password:temp});
assert.equal(first.passwordChangeRequired,true);
assert.equal(first.refreshToken,undefined);
await api('GET','/employees',403,undefined,first.accessToken);
const {accessToken:ceo}=await api('POST','/auth/change-password',200,{currentPassword:temp,password},first.accessToken);
const me=await api('GET','/auth/me',200,undefined,ceo);
const roles=await api('GET','/access/roles',200,undefined,ceo);
const role=(key)=>roles.find(r=>r.key===key).id;
async function onboard(key,roleKey,boss) {
  const address=key+'-'+suffix+'@example.test';
  const employee=await api('POST','/employees',201,{name:key,email:address,joinedOn:'2026-11-15',temporaryPassword:starter},ceo);
  assert.match(employee.employee_code,/^RCT-[0-9]{4,}$/);
  await api('POST','/auth/login',401,{email:address,password:starter});
  await api('POST','/employees/'+employee.id+'/activate',204,{roleId:role(roleKey),reportingBossId:boss},ceo);
  const limited=await api('POST','/auth/login',200,{email:address,password:starter});
  const active=await api('POST','/auth/change-password',200,{currentPassword:starter,password},limited.accessToken);
  return {...employee,...active,email:address};
}
const hr=await onboard('hr','hr',me.employeeId);
const exec=await onboard('exec','sales_executive',hr.id);
await api('GET','/employees/'+hr.id,403,undefined,exec.accessToken);
await api('GET','/employees/'+exec.id,200,undefined,exec.accessToken);
await api('POST','/access/roles',403,{key:'oops',name:'Oops',description:'Invalid'},exec.accessToken);
const custom=await api('POST','/access/roles',201,{key:'smoke_'+suffix,name:'Smoke Role',description:'Verification role'},ceo);
const catalog=await api('GET','/access/catalog',200,undefined,ceo);
const grant=await api('POST','/access/roles/'+custom.id+'/grants',201,{
  permissionId:catalog.permissions.find(p=>p.key==='employee_profile.read').id,scope:'own',
},ceo);
const phone=catalog.fields.find(f=>f.field_key==='phone');
await api('PUT','/access/grants/'+grant.id+'/field-policies',200,{resourceFieldId:phone.id,access:'read'},ceo);
const rr=await api('POST','/organization/requests/role-change',201,{
  employeeId:exec.id,roleId:custom.id,operation:'grant',reason:'Verification',
},hr.accessToken);
const inbox=await api('GET','/notifications',200,undefined,hr.accessToken);
const notification=inbox.find(n=>n.request_id===rr.id&&n.event_key==='approval.pending');
assert.ok(notification);
await api('PATCH','/notifications/'+notification.id+'/read',404,undefined,exec.accessToken);
await api('PATCH','/notifications/'+notification.id+'/read',200,undefined,hr.accessToken);
const decision=(id,token,status=200)=>api('PATCH','/organization/requests/'+id+'/decision',status,{decision:'approved'},token);
await decision(rr.id,ceo,403);
await decision(rr.id,hr.accessToken);
await decision(rr.id,ceo);
await api('PATCH','/organization/requests/'+rr.id+'/apply',409,{openTasksCompleted:false},ceo);
await api('PATCH','/organization/requests/'+rr.id+'/apply',200,{openTasksCompleted:true},ceo);
const active=await api('GET','/auth/me',200,undefined,exec.accessToken);
assert.ok(active.roles.includes(custom.key)&&active.roles.includes('sales_executive'));
const pr=await api('POST','/organization/requests/profile-change',201,{field:'phone',value:'0123456789'},exec.accessToken);
await decision(pr.id,exec.accessToken,403);
await decision(pr.id,hr.accessToken);
const profile=await api('GET','/employees/'+exec.id,200,undefined,exec.accessToken);
assert.equal(profile.phone,'0123456789');
assert.ok(!Object.hasOwn(profile,'nid')&&!Object.hasOwn(profile,'password_hash'));
const payout=await api('POST','/organization/requests/payment-change',201,{
  method:'bank',provider:'Demo Bank',accountReference:'DEMOACCOUNT1234',
},exec.accessToken);
const details=await api('GET','/organization/requests/'+payout.id,200,undefined,hr.accessToken);
assert.ok(!JSON.stringify(details).includes('DEMOACCOUNT'));
await decision(payout.id,hr.accessToken);
const masked=await api('GET','/employees/'+exec.id+'/payment-details',200,undefined,exec.accessToken);
assert.equal(masked.reference_last_four,'1234');
const shift=await api('POST','/shifts',201,{code:'NIGHT-'+suffix,name:'Night',startsAt:'22:00',endsAt:'06:00'},ceo);
await api('PATCH','/employees/'+exec.id+'/shift',200,{shiftId:shift.id},hr.accessToken);
const upload=new FormData();
upload.set('type','cv');
const pdf='%PDF-1.4\n%%EOF';
upload.set('file',new Blob([pdf],{type:'application/pdf'}),'demo.pdf');
const uploaded=await api('POST','/employees/'+exec.id+'/documents',201,upload,hr.accessToken);
const filePath='/employees/'+exec.id+'/documents/'+uploaded.id;
assert.equal(await api('GET',filePath,200,undefined,exec.accessToken),pdf);
await api('PATCH',filePath+'/archive',200,undefined,ceo);
await api('GET',filePath,404,undefined,exec.accessToken);
await api('GET','/audit',403,undefined,hr.accessToken);
await api('GET','/audit',200,undefined,ceo);
const rotated=await api('POST','/auth/refresh',200,{refreshToken:exec.refreshToken});
await api('POST','/auth/refresh',401,{refreshToken:exec.refreshToken});
await api('GET','/auth/me',401,undefined,rotated.accessToken);
const old=await api('POST','/auth/login',200,{email:exec.email,password});
const current=await api('POST','/auth/login',200,{email:exec.email,password});
await api('GET','/auth/me',401,undefined,old.accessToken);
await api('POST','/auth/logout',204,undefined,current.accessToken);
await api('GET','/auth/me',401,undefined,current.accessToken);
console.log(checked+' HTTP checks passed');
