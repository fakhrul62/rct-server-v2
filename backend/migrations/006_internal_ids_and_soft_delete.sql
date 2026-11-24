SET LOCAL search_path TO identity, public;

CREATE SCHEMA identity_live;

ALTER TABLE employees DROP CONSTRAINT employees_check;

ALTER TABLE employees DROP CONSTRAINT employees_reporting_boss_id_fkey;

ALTER TABLE employees DROP CONSTRAINT employees_shift_id_fkey;

ALTER TABLE employees DROP CONSTRAINT employees_created_by_fkey;

ALTER TABLE employees DROP CONSTRAINT employees_updated_by_fkey;

ALTER TABLE employee_documents DROP CONSTRAINT employee_documents_employee_id_fkey;

ALTER TABLE employee_documents DROP CONSTRAINT employee_documents_created_by_fkey;

ALTER TABLE employee_documents DROP CONSTRAINT employee_documents_updated_by_fkey;

ALTER TABLE employee_payment_details DROP CONSTRAINT employee_payment_details_employee_id_fkey;

ALTER TABLE employee_payment_details DROP CONSTRAINT employee_payment_details_created_by_fkey;

ALTER TABLE employee_payment_details DROP CONSTRAINT employee_payment_details_updated_by_fkey;

ALTER TABLE shifts DROP CONSTRAINT shifts_created_by_fkey;

ALTER TABLE shifts DROP CONSTRAINT shifts_updated_by_fkey;

ALTER TABLE user_accounts DROP CONSTRAINT user_accounts_employee_id_fkey;

ALTER TABLE user_accounts DROP CONSTRAINT user_accounts_created_by_fkey;

ALTER TABLE user_accounts DROP CONSTRAINT user_accounts_updated_by_fkey;

ALTER TABLE login_sessions DROP CONSTRAINT login_sessions_user_account_id_fkey;

ALTER TABLE login_sessions DROP CONSTRAINT login_sessions_created_by_fkey;

ALTER TABLE login_sessions DROP CONSTRAINT login_sessions_updated_by_fkey;

ALTER TABLE otp_challenges DROP CONSTRAINT otp_challenges_user_account_id_fkey;

ALTER TABLE otp_challenges DROP CONSTRAINT otp_challenges_session_id_fkey;

ALTER TABLE otp_challenges DROP CONSTRAINT otp_challenges_created_by_fkey;

ALTER TABLE otp_challenges DROP CONSTRAINT otp_challenges_updated_by_fkey;

ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_session_id_fkey;

ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_replaces_token_id_fkey;

ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_created_by_fkey;

ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_updated_by_fkey;

ALTER TABLE roles DROP CONSTRAINT roles_created_by_fkey;

ALTER TABLE roles DROP CONSTRAINT roles_updated_by_fkey;

ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_role_id_fkey;

ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_permission_id_fkey;

ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_created_by_fkey;

ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_updated_by_fkey;

ALTER TABLE permissions DROP CONSTRAINT permissions_resource_id_fkey;

ALTER TABLE permissions DROP CONSTRAINT permissions_created_by_fkey;

ALTER TABLE permissions DROP CONSTRAINT permissions_updated_by_fkey;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_employee_id_fkey;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_role_id_fkey;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_source_request_id_fkey;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_created_by_fkey;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_updated_by_fkey;

ALTER TABLE field_policies DROP CONSTRAINT field_policies_role_permission_id_fkey;

ALTER TABLE field_policies DROP CONSTRAINT field_policies_resource_field_id_fkey;

ALTER TABLE field_policies DROP CONSTRAINT field_policies_created_by_fkey;

ALTER TABLE field_policies DROP CONSTRAINT field_policies_updated_by_fkey;

ALTER TABLE resource_fields DROP CONSTRAINT resource_fields_resource_id_fkey;

ALTER TABLE resource_fields DROP CONSTRAINT resource_fields_created_by_fkey;

ALTER TABLE resource_fields DROP CONSTRAINT resource_fields_updated_by_fkey;

ALTER TABLE access_resources DROP CONSTRAINT access_resources_created_by_fkey;

ALTER TABLE access_resources DROP CONSTRAINT access_resources_updated_by_fkey;

ALTER TABLE organization_requests DROP CONSTRAINT organization_requests_employee_id_fkey;

ALTER TABLE organization_requests DROP CONSTRAINT organization_requests_requested_by_account_id_fkey;

ALTER TABLE organization_requests DROP CONSTRAINT organization_requests_created_by_fkey;

ALTER TABLE organization_requests DROP CONSTRAINT organization_requests_updated_by_fkey;

ALTER TABLE role_change_items DROP CONSTRAINT role_change_items_request_id_fkey;

ALTER TABLE role_change_items DROP CONSTRAINT role_change_items_role_id_fkey;

ALTER TABLE role_change_items DROP CONSTRAINT role_change_items_created_by_fkey;

ALTER TABLE role_change_items DROP CONSTRAINT role_change_items_updated_by_fkey;

ALTER TABLE delegations DROP CONSTRAINT delegations_delegator_employee_id_fkey;

ALTER TABLE delegations DROP CONSTRAINT delegations_delegate_employee_id_fkey;

ALTER TABLE delegations DROP CONSTRAINT delegations_created_by_fkey;

ALTER TABLE delegations DROP CONSTRAINT delegations_updated_by_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_request_id_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_assigned_employee_id_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_acted_by_account_id_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_delegation_id_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_created_by_fkey;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_updated_by_fkey;

ALTER TABLE profile_change_items DROP CONSTRAINT profile_change_items_request_id_fkey;

ALTER TABLE profile_change_items DROP CONSTRAINT profile_change_items_resource_field_id_fkey;

ALTER TABLE profile_change_items DROP CONSTRAINT profile_change_items_created_by_fkey;

ALTER TABLE profile_change_items DROP CONSTRAINT profile_change_items_updated_by_fkey;

ALTER TABLE audit_events DROP CONSTRAINT audit_events_actor_account_id_fkey;

ALTER TABLE audit_events DROP CONSTRAINT audit_events_subject_employee_id_fkey;

ALTER TABLE audit_events DROP CONSTRAINT audit_events_created_by_fkey;

ALTER TABLE audit_events DROP CONSTRAINT audit_events_updated_by_fkey;

ALTER TABLE identity_notifications DROP CONSTRAINT identity_notifications_employee_id_fkey;

ALTER TABLE identity_notifications DROP CONSTRAINT identity_notifications_request_id_fkey;

ALTER TABLE identity_notifications DROP CONSTRAINT identity_notifications_created_by_fkey;

ALTER TABLE identity_notifications DROP CONSTRAINT identity_notifications_updated_by_fkey;

ALTER TABLE employees RENAME COLUMN id TO uuid;

ALTER TABLE employees DROP CONSTRAINT employees_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE employee_documents RENAME COLUMN id TO uuid;

ALTER TABLE employee_documents DROP CONSTRAINT employee_documents_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE employee_payment_details RENAME COLUMN id TO uuid;

ALTER TABLE employee_payment_details DROP CONSTRAINT employee_payment_details_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE shifts RENAME COLUMN id TO uuid;

ALTER TABLE shifts DROP CONSTRAINT shifts_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE user_accounts RENAME COLUMN id TO uuid;

ALTER TABLE user_accounts DROP CONSTRAINT user_accounts_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE login_sessions RENAME COLUMN id TO uuid;

ALTER TABLE login_sessions DROP CONSTRAINT login_sessions_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE otp_challenges RENAME COLUMN id TO uuid;

ALTER TABLE otp_challenges DROP CONSTRAINT otp_challenges_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE refresh_tokens RENAME COLUMN id TO uuid;

ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE roles RENAME COLUMN id TO uuid;

ALTER TABLE roles DROP CONSTRAINT roles_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE role_permissions RENAME COLUMN id TO uuid;

ALTER TABLE role_permissions DROP CONSTRAINT role_permissions_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE permissions RENAME COLUMN id TO uuid;

ALTER TABLE permissions DROP CONSTRAINT permissions_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE role_assignments RENAME COLUMN id TO uuid;

ALTER TABLE role_assignments DROP CONSTRAINT role_assignments_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE field_policies RENAME COLUMN id TO uuid;

ALTER TABLE field_policies DROP CONSTRAINT field_policies_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE resource_fields RENAME COLUMN id TO uuid;

ALTER TABLE resource_fields DROP CONSTRAINT resource_fields_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE access_resources RENAME COLUMN id TO uuid;

ALTER TABLE access_resources DROP CONSTRAINT access_resources_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE organization_requests RENAME COLUMN id TO uuid;

ALTER TABLE organization_requests DROP CONSTRAINT organization_requests_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE role_change_items RENAME COLUMN id TO uuid;

ALTER TABLE role_change_items DROP CONSTRAINT role_change_items_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE delegations RENAME COLUMN id TO uuid;

ALTER TABLE delegations DROP CONSTRAINT delegations_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE organization_approval_steps RENAME COLUMN id TO uuid;

ALTER TABLE organization_approval_steps DROP CONSTRAINT organization_approval_steps_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE profile_change_items RENAME COLUMN id TO uuid;

ALTER TABLE profile_change_items DROP CONSTRAINT profile_change_items_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE audit_events RENAME COLUMN id TO uuid;

ALTER TABLE audit_events DROP CONSTRAINT audit_events_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

ALTER TABLE identity_notifications RENAME COLUMN id TO uuid;

ALTER TABLE identity_notifications DROP CONSTRAINT identity_notifications_pkey, ADD UNIQUE(uuid), ALTER COLUMN uuid SET DEFAULT gen_random_uuid(), ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ADD COLUMN deleted_at timestamptz;

CREATE FUNCTION id_for_access_resources(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM access_resources WHERE uuid=$1 $$;

CREATE FUNCTION id_for_delegations(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM delegations WHERE uuid=$1 $$;

CREATE FUNCTION id_for_employees(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM employees WHERE uuid=$1 $$;

CREATE FUNCTION id_for_login_sessions(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM login_sessions WHERE uuid=$1 $$;

CREATE FUNCTION id_for_organization_requests(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM organization_requests WHERE uuid=$1 $$;

CREATE FUNCTION id_for_permissions(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM permissions WHERE uuid=$1 $$;

CREATE FUNCTION id_for_refresh_tokens(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM refresh_tokens WHERE uuid=$1 $$;

CREATE FUNCTION id_for_resource_fields(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM resource_fields WHERE uuid=$1 $$;

CREATE FUNCTION id_for_role_permissions(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM role_permissions WHERE uuid=$1 $$;

CREATE FUNCTION id_for_roles(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM roles WHERE uuid=$1 $$;

CREATE FUNCTION id_for_shifts(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM shifts WHERE uuid=$1 $$;

CREATE FUNCTION id_for_user_accounts(key uuid) RETURNS bigint LANGUAGE sql STABLE STRICT SET search_path=identity,pg_catalog AS $$ SELECT id FROM user_accounts WHERE uuid=$1 $$;

ALTER TABLE employees ALTER COLUMN reporting_boss_id TYPE bigint USING id_for_employees(reporting_boss_id),
  ALTER COLUMN shift_id TYPE bigint USING id_for_shifts(shift_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE employee_documents ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE employee_payment_details ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE shifts ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE user_accounts ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE login_sessions ALTER COLUMN user_account_id TYPE bigint USING id_for_user_accounts(user_account_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE otp_challenges ALTER COLUMN user_account_id TYPE bigint USING id_for_user_accounts(user_account_id),
  ALTER COLUMN session_id TYPE bigint USING id_for_login_sessions(session_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE refresh_tokens ALTER COLUMN session_id TYPE bigint USING id_for_login_sessions(session_id),
  ALTER COLUMN replaces_token_id TYPE bigint USING id_for_refresh_tokens(replaces_token_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE roles ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE role_permissions ALTER COLUMN role_id TYPE bigint USING id_for_roles(role_id),
  ALTER COLUMN permission_id TYPE bigint USING id_for_permissions(permission_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE permissions ALTER COLUMN resource_id TYPE bigint USING id_for_access_resources(resource_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE role_assignments ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN role_id TYPE bigint USING id_for_roles(role_id),
  ALTER COLUMN source_request_id TYPE bigint USING id_for_organization_requests(source_request_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE field_policies ALTER COLUMN role_permission_id TYPE bigint USING id_for_role_permissions(role_permission_id),
  ALTER COLUMN resource_field_id TYPE bigint USING id_for_resource_fields(resource_field_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE resource_fields ALTER COLUMN resource_id TYPE bigint USING id_for_access_resources(resource_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE access_resources ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE organization_requests ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN requested_by_account_id TYPE bigint USING id_for_user_accounts(requested_by_account_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE role_change_items ALTER COLUMN request_id TYPE bigint USING id_for_organization_requests(request_id),
  ALTER COLUMN role_id TYPE bigint USING id_for_roles(role_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE delegations ALTER COLUMN delegator_employee_id TYPE bigint USING id_for_employees(delegator_employee_id),
  ALTER COLUMN delegate_employee_id TYPE bigint USING id_for_employees(delegate_employee_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE organization_approval_steps ALTER COLUMN request_id TYPE bigint USING id_for_organization_requests(request_id),
  ALTER COLUMN assigned_employee_id TYPE bigint USING id_for_employees(assigned_employee_id),
  ALTER COLUMN acted_by_account_id TYPE bigint USING id_for_user_accounts(acted_by_account_id),
  ALTER COLUMN delegation_id TYPE bigint USING id_for_delegations(delegation_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE profile_change_items ALTER COLUMN request_id TYPE bigint USING id_for_organization_requests(request_id),
  ALTER COLUMN resource_field_id TYPE bigint USING id_for_resource_fields(resource_field_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE audit_events ALTER COLUMN actor_account_id TYPE bigint USING id_for_user_accounts(actor_account_id),
  ALTER COLUMN subject_employee_id TYPE bigint USING id_for_employees(subject_employee_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE identity_notifications ALTER COLUMN employee_id TYPE bigint USING id_for_employees(employee_id),
  ALTER COLUMN request_id TYPE bigint USING id_for_organization_requests(request_id),
  ALTER COLUMN created_by TYPE bigint USING id_for_user_accounts(created_by),
  ALTER COLUMN updated_by TYPE bigint USING id_for_user_accounts(updated_by);

ALTER TABLE employees ADD FOREIGN KEY (reporting_boss_id) REFERENCES employees(id);

ALTER TABLE employees ADD FOREIGN KEY (shift_id) REFERENCES shifts(id);

ALTER TABLE employees ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE employees ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE employee_documents ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE employee_documents ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE employee_documents ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE employee_payment_details ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE employee_payment_details ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE employee_payment_details ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE shifts ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE shifts ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE user_accounts ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE user_accounts ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE user_accounts ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE login_sessions ADD FOREIGN KEY (user_account_id) REFERENCES user_accounts(id);

ALTER TABLE login_sessions ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE login_sessions ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE otp_challenges ADD FOREIGN KEY (user_account_id) REFERENCES user_accounts(id);

ALTER TABLE otp_challenges ADD FOREIGN KEY (session_id) REFERENCES login_sessions(id);

ALTER TABLE otp_challenges ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE otp_challenges ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE refresh_tokens ADD FOREIGN KEY (session_id) REFERENCES login_sessions(id);

ALTER TABLE refresh_tokens ADD FOREIGN KEY (replaces_token_id) REFERENCES refresh_tokens(id);

ALTER TABLE refresh_tokens ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE refresh_tokens ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE roles ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE roles ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE role_permissions ADD FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE role_permissions ADD FOREIGN KEY (permission_id) REFERENCES permissions(id);

ALTER TABLE role_permissions ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE role_permissions ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE permissions ADD FOREIGN KEY (resource_id) REFERENCES access_resources(id);

ALTER TABLE permissions ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE permissions ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE role_assignments ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE role_assignments ADD FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE role_assignments ADD FOREIGN KEY (source_request_id) REFERENCES organization_requests(id);

ALTER TABLE role_assignments ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE role_assignments ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE field_policies ADD FOREIGN KEY (role_permission_id) REFERENCES role_permissions(id);

ALTER TABLE field_policies ADD FOREIGN KEY (resource_field_id) REFERENCES resource_fields(id);

ALTER TABLE field_policies ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE field_policies ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE resource_fields ADD FOREIGN KEY (resource_id) REFERENCES access_resources(id);

ALTER TABLE resource_fields ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE resource_fields ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE access_resources ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE access_resources ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE organization_requests ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE organization_requests ADD FOREIGN KEY (requested_by_account_id) REFERENCES user_accounts(id);

ALTER TABLE organization_requests ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE organization_requests ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE role_change_items ADD FOREIGN KEY (request_id) REFERENCES organization_requests(id);

ALTER TABLE role_change_items ADD FOREIGN KEY (role_id) REFERENCES roles(id);

ALTER TABLE role_change_items ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE role_change_items ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE delegations ADD FOREIGN KEY (delegator_employee_id) REFERENCES employees(id);

ALTER TABLE delegations ADD FOREIGN KEY (delegate_employee_id) REFERENCES employees(id);

ALTER TABLE delegations ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE delegations ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (request_id) REFERENCES organization_requests(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (assigned_employee_id) REFERENCES employees(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (acted_by_account_id) REFERENCES user_accounts(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (delegation_id) REFERENCES delegations(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE organization_approval_steps ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE profile_change_items ADD FOREIGN KEY (request_id) REFERENCES organization_requests(id);

ALTER TABLE profile_change_items ADD FOREIGN KEY (resource_field_id) REFERENCES resource_fields(id);

ALTER TABLE profile_change_items ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE profile_change_items ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE audit_events ADD FOREIGN KEY (actor_account_id) REFERENCES user_accounts(id);

ALTER TABLE audit_events ADD FOREIGN KEY (subject_employee_id) REFERENCES employees(id);

ALTER TABLE audit_events ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE audit_events ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

ALTER TABLE identity_notifications ADD FOREIGN KEY (employee_id) REFERENCES employees(id);

ALTER TABLE identity_notifications ADD FOREIGN KEY (request_id) REFERENCES organization_requests(id);

ALTER TABLE identity_notifications ADD FOREIGN KEY (created_by) REFERENCES user_accounts(id);

ALTER TABLE identity_notifications ADD FOREIGN KEY (updated_by) REFERENCES user_accounts(id);

DROP FUNCTION id_for_access_resources(uuid);

DROP FUNCTION id_for_delegations(uuid);

DROP FUNCTION id_for_employees(uuid);

DROP FUNCTION id_for_login_sessions(uuid);

DROP FUNCTION id_for_organization_requests(uuid);

DROP FUNCTION id_for_permissions(uuid);

DROP FUNCTION id_for_refresh_tokens(uuid);

DROP FUNCTION id_for_resource_fields(uuid);

DROP FUNCTION id_for_role_permissions(uuid);

DROP FUNCTION id_for_roles(uuid);

DROP FUNCTION id_for_shifts(uuid);

DROP FUNCTION id_for_user_accounts(uuid);

ALTER TABLE employees ADD CONSTRAINT employees_reporting_boss_check CHECK (reporting_boss_id IS DISTINCT FROM id);

CREATE FUNCTION prevent_identity_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Identity records are retained. Set deleted_at to retire a row.' USING ERRCODE='23514';
END
$$;

CREATE VIEW identity_live.employees AS SELECT * FROM identity.employees WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON employees FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.employee_documents AS SELECT * FROM identity.employee_documents WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON employee_documents FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.employee_payment_details AS SELECT * FROM identity.employee_payment_details WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON employee_payment_details FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.shifts AS SELECT * FROM identity.shifts WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON shifts FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.user_accounts AS SELECT * FROM identity.user_accounts WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON user_accounts FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.login_sessions AS SELECT * FROM identity.login_sessions WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON login_sessions FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.otp_challenges AS SELECT * FROM identity.otp_challenges WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON otp_challenges FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.refresh_tokens AS SELECT * FROM identity.refresh_tokens WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.roles AS SELECT * FROM identity.roles WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON roles FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.role_permissions AS SELECT * FROM identity.role_permissions WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON role_permissions FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.permissions AS SELECT * FROM identity.permissions WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON permissions FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.role_assignments AS SELECT * FROM identity.role_assignments WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON role_assignments FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.field_policies AS SELECT * FROM identity.field_policies WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON field_policies FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.resource_fields AS SELECT * FROM identity.resource_fields WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON resource_fields FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.access_resources AS SELECT * FROM identity.access_resources WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON access_resources FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.organization_requests AS SELECT * FROM identity.organization_requests WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON organization_requests FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.role_change_items AS SELECT * FROM identity.role_change_items WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON role_change_items FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.delegations AS SELECT * FROM identity.delegations WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON delegations FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.organization_approval_steps AS SELECT * FROM identity.organization_approval_steps WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON organization_approval_steps FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.profile_change_items AS SELECT * FROM identity.profile_change_items WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON profile_change_items FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.audit_events AS SELECT * FROM identity.audit_events WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();

CREATE VIEW identity_live.identity_notifications AS SELECT * FROM identity.identity_notifications WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

CREATE TRIGGER prevent_delete BEFORE DELETE ON identity_notifications FOR EACH ROW EXECUTE FUNCTION prevent_identity_delete();
