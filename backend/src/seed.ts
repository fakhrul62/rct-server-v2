import { Database } from './database.js';
import { hashPassword } from './auth.js';
import { profileFields, roleCatalog } from './catalog.js';
const db=new Database();
try {
  await db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(38342)');
    const ids:Record<string,string>={};
    for (const [key,name] of roleCatalog) {
      await tx.query(`INSERT INTO roles(key,name,description,role_kind,status)
        VALUES($1,$2,$3,'system','active') ON CONFLICT(key) DO NOTHING`,[key,name,name+' (PRD Ã‚Â§8)']);
      ids[key]=(await tx.query('SELECT id FROM roles WHERE key=$1',[key])).rows[0].id;
    }
    await tx.query(`INSERT INTO access_resources(key,description,status) VALUES('employee_profile','Employee profile','active')
      ON CONFLICT(key) DO NOTHING`);
    const res=(await tx.query(`SELECT id FROM access_resources WHERE key='employee_profile'`)).rows[0].id;
    for (const [key,sensitivity] of Object.entries({...profileFields,payment_details:"compensation"})) {
      await tx.query(`INSERT INTO resource_fields(resource_id,field_key,description,sensitivity,status)
        VALUES($1,$2,$2,$3,'active') ON CONFLICT(resource_id,field_key) DO NOTHING`,[res,key,sensitivity]);
    }
    for (const action of ['read','update']) {
      await tx.query(`INSERT INTO permissions(resource_id,key,action,description,sensitivity,status)
        VALUES($1,$2,$3,$4,'personal','active') ON CONFLICT(key) DO NOTHING`,
        [res,'employee_profile.'+action,action,'Employee profile '+action]);
    }
    const read=(await tx.query(`SELECT id FROM permissions WHERE key='employee_profile.read'`)).rows[0].id;
    const initialized=(await tx.query(`SELECT 1 FROM identity.user_accounts LIMIT 1`)).rowCount;
    // Grants are initialized once so a later operational revocation stays in effect.
    if (initialized) { console.log('Catalog checked. CEO already exists.'); return; }
    const email=process.env.CEO_EMAIL?.trim().toLowerCase();
    const password=process.env.CEO_TEMP_PASSWORD;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length<12 || password.length>128) {
      throw new Error('Set CEO_EMAIL and CEO_TEMP_PASSWORD (12Ã¢â‚¬â€œ128 characters) for initial setup.');
    }
    for (const [key] of roleCatalog) {
      const scope=['ceo','dgm','hr'].includes(key)?'all':'own';
      const grant=(await tx.query(`INSERT INTO role_permissions(role_id,permission_id,record_scope)
        VALUES($1,$2,$3) RETURNING id`,[ids[key],read,scope])).rows[0].id;
      await tx.query(`INSERT INTO field_policies(role_permission_id,resource_field_id,access_level)
        SELECT $1,id,'read' FROM resource_fields WHERE resource_id=$2
          AND (field_key<>'nid' OR $3='ceo')`,[grant,res,key]);
    }
    const update=(await tx.query(`SELECT id FROM permissions WHERE key='employee_profile.update'`)).rows[0].id;
    const writer=(await tx.query(`INSERT INTO role_permissions(role_id,permission_id,record_scope)
      VALUES($1,$2,'all') RETURNING id`,[ids.ceo,update])).rows[0].id;
    await tx.query(`INSERT INTO field_policies(role_permission_id,resource_field_id,access_level)
      SELECT $1,id,'write' FROM resource_fields WHERE resource_id=$2 AND field_key=ANY($3::text[])`,
      [writer,res,['phone','address','emergency_contact_name','emergency_contact_phone']]);
    const employee=(await tx.query(`INSERT INTO employees(first_name,email,joined_on,employment_status)
      VALUES('CEO',$1,(now() AT TIME ZONE 'Asia/Dhaka')::date,'confirmed') RETURNING id`,[email])).rows[0].id;
    await tx.query(`INSERT INTO user_accounts(employee_id,password_hash,password_change_status,account_status,activated_at)
      VALUES($1,$2,'required','active',now())`,[employee,await hashPassword(password)]);
    await tx.query('INSERT INTO role_assignments(employee_id,role_id,valid_from) VALUES($1,$2,now())',[employee,ids.ceo]);
    console.log('Initial CEO account created. Change its temporary password at first sign-in.');
  });
} finally { await db.onModuleDestroy(); }
