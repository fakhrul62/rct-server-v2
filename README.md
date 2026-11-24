# RCT ERP User Management API

NestJS with Fastify, PostgreSQL 18, and raw SQL through `pg`. Request values are bound with `$1`, `$2`, and so on. The only dynamic column names are selected from the fixed employee profile field list.

## Start locally with Docker

Run these commands from the `RCT` directory:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Put the generated value in `JWT_SECRET` in `.env`. Set `CEO_EMAIL` and a unique `CEO_TEMP_PASSWORD` of 12 to 128 characters. Leave the local database defaults for the first run. Use the same password in the database and api connection settings if you customize it. PostgreSQL initializes its password when the volume is created.

```powershell
docker compose up -d --wait database
docker compose build api
docker compose run --rm api node dist/migrate.js
docker compose run --rm --env-from-file .env -e DATABASE_URL=postgresql://rct:local_rct_postgres@database:5432/rct api node dist/seed.js
docker compose up -d api
```

Open [Swagger](http://localhost:3001/docs) and [the OpenAPI JSON](http://localhost:3001/docs/openapi.json).

The seed is idempotent. Running it again does not reset an existing account or restore revoked grants. After the seed, remove the bootstrap password from `.env`. At first login, use the returned limited access token only to call `POST /api/auth/change-password`, then replace it in Swagger with the new access token.

### Run the API on Windows with PostgreSQL in Docker

From `RCT`, start only PostgreSQL with `docker compose up -d --wait database`. Then run:

```powershell
cd backend
npm ci
npm run build
npm run migrate
npm run seed
npm start
```

The commands load the root `.env`. For a host process, the database hostname is `127.0.0.1` and the port is `55432`. Inside the API container, the hostname is `database` and the port is `5432`.

## Workflow to try in Swagger

1. Sign in as the CEO and change the temporary password.
2. View the built-in role IDs using `GET /api/access/roles`.
3. Create an employee and temporary account with `POST /api/employees`. Their account starts pending.
4. Activate the account with `POST /api/employees/{id}/activate`, supplying the employee's role ID and reporting boss ID.
5. Sign in separately as the employee, change their temporary password, and read their own profile.
6. Submit a profile change request and approve it as HR. Check the notifications and CEO audit log.

## Source layout

- `backend/migrations` contains ordered PostgreSQL changes, enums, bigint primary and foreign keys, public UUIDs, actor fields, and constraints.
- `backend/src/auth.ts` handles Argon2id passwords, session-backed access tokens, the 30-minute idle timeout, refresh rotation, and session revocation.
- `backend/src/employees.ts` handles onboarding, profiles, shifts, files, payment details, and account state. Upload documents with multipart form data; the local implementation stores up to 5 MiB per document in PostgreSQL.
- `backend/src/access.ts` and `roles.ts` enforce the User Management permission catalog, role grants, own/all record scope, and field policies. Each granted field is checked against the grantâ€™s record scope. Dedicated operations such as salary changes have their own authorization checks.
- `backend/src/workflow.ts` handles role, profile, payment, probation, resignation, and termination requests. Approvals, notifications, and audit entries commit with the change.
- `scripts/identity-otp-smoke.mjs` verifies OTP with a local SMTP fixture. Point `DATABASE_URL` at a disposable seeded database and set `SMOKE_CEO_EMAIL` and `SMOKE_CEO_PASSWORD`.
- `scripts/identity-smoke.mjs` exercises the API on a **disposable database**. Set `SMOKE_URL`, `SMOKE_CEO_EMAIL`, and `SMOKE_CEO_PASSWORD` to the freshly seeded account. The script changes that account's password and creates fixture records.

## Integration boundaries

Each business table has an internal bigint identity primary key and a separate unique UUID for API input, responses, and JWT claims. Foreign keys use bigint. Existing UUIDs survive the migration and newly created records get random UUIDs. Retirement sets `deleted_at` where the API archives an entity; active views exclude retired records. Database triggers block row deletion. Audit records are append-only.

Optional sign-in OTP can be enabled by setting `OTP_ENABLED=true`, `OTP_SMTP_URL`, `OTP_FROM`, and a separate random `OTP_PEPPER` of at least 32 bytes. Use a real, TLS-capable SMTP provider for a deployed environment. Login then responds with `otpRequired` and `challengeId`; submit the emailed six-digit code to `POST /api/auth/otp/verify`. Its verifier is hashed with Argon2id after keyed preprocessing. Codes expire in three minutes, permit five failed attempts, and work once. Password reset and deactivation remain HR/CEO workflows. The schema has purpose values for adding OTP to those workflows later.

The API records revoked access-token IDs in PostgreSQL and checks both the blacklist and session status on protected requests. This works across API instances sharing the database. The PeopleKit example illustrates tenant isolation, but RCT currently has one organization: role and permission keys are unique in that organization and grants support own/all record scope. Explicit field grants can allow a role to write a specific editable field without granting other employee operations.

The Task, Leave, Payroll, and other modules are separate. Applying a promotion currently requires a CEO confirmation that the employee's open tasks are complete. Approval coverage is recorded manually against the reporting chain pending integration with Leave. Exit closes the login and active assignments; downstream reassignment and final pay belong to those other modules.

The local Compose setup binds both services to loopback. Use HTTPS, private database access, and deployment-specific credentials when deploying.
