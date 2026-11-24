CREATE SCHEMA IF NOT EXISTS identity;

SET search_path TO identity, public;

CREATE TYPE employment_status_value AS ENUM ('pending_onboarding', 'probation', 'confirmed', 'exit_pending', 'exited');

CREATE TYPE executor_subtype_value AS ENUM ('web_developer', 'digital_marketer', 'video_editor');

CREATE TYPE document_type_value AS ENUM ('cv', 'nid_copy', 'appointment_letter', 'other');

CREATE TYPE payment_method_value AS ENUM ('bank', 'mobile_banking');

CREATE TYPE password_change_status_value AS ENUM ('required', 'current');

CREATE TYPE account_status_value AS ENUM ('pending_activation', 'active', 'suspended', 'closed');

CREATE TYPE session_status_value AS ENUM ('active', 'ended');

CREATE TYPE end_reason_value AS ENUM ('logout', 'idle_timeout', 'replaced', 'account_disabled', 'password_reset', 'security_revoked');

CREATE TYPE purpose_value AS ENUM ('password_reset', 'second_factor', 'account_deactivation');

CREATE TYPE challenge_status_value AS ENUM ('pending', 'consumed', 'expired', 'cancelled');

CREATE TYPE role_kind_value AS ENUM ('system', 'custom');

CREATE TYPE sensitivity_value AS ENUM ('public', 'internal', 'personal', 'compensation', 'performance', 'special_category', 'secret');

CREATE TYPE record_scope_value AS ENUM ('own', 'team', 'assigned', 'all');

CREATE TYPE access_level_value AS ENUM ('none', 'read', 'write');

CREATE TYPE scope_value AS ENUM ('approvals');

CREATE TYPE request_type_value AS ENUM ('role_change', 'profile_change', 'probation', 'resignation', 'termination');

CREATE TYPE request_status_value AS ENUM ('pending', 'approved', 'rejected', 'applied', 'cancelled');

CREATE TYPE probation_outcome_value AS ENUM ('confirm', 'extend', 'exit');

CREATE TYPE operation_value AS ENUM ('grant', 'end_grant');

CREATE TYPE step_kind_value AS ENUM ('recommend', 'review', 'approve');

CREATE TYPE decision_value AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE status_value AS ENUM ('active', 'archived');

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_code text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NULL,
  address text NULL,
  nid text NULL,
  birth_date date NULL,
  photo_ref text NULL,
  emergency_contact_name text NULL,
  emergency_contact_phone text NULL,
  joined_on date NOT NULL,
  probation_end_on date NULL,
  employment_status employment_status_value NOT NULL,
  executor_subtype executor_subtype_value NULL,
  gross_salary numeric NULL,
  reporting_boss_id uuid NULL,
  shift_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE employee_documents (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL,
  document_type document_type_value NOT NULL,
  storage_ref text NOT NULL,
  status status_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE employee_payment_details (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL UNIQUE,
  payment_method payment_method_value NOT NULL,
  provider_name text NOT NULL,
  account_reference text NOT NULL,
  account_holder_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  status status_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE user_accounts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL UNIQUE,
  password_hash text NOT NULL,
  password_change_status password_change_status_value NOT NULL,
  account_status account_status_value NOT NULL,
  password_changed_at timestamptz NULL,
  activated_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE login_sessions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_account_id uuid NOT NULL,
  session_status session_status_value NOT NULL,
  device_label text NULL,
  source_ip inet NULL,
  started_at timestamptz NOT NULL,
  last_active_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  end_reason end_reason_value NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE otp_challenges (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  user_account_id uuid NOT NULL,
  session_id uuid NULL,
  purpose purpose_value NOT NULL,
  code_verifier text NOT NULL,
  challenge_status challenge_status_value NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  session_id uuid NOT NULL,
  replaces_token_id uuid NULL UNIQUE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  role_kind role_kind_value NOT NULL,
  status status_value NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE role_permissions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  record_scope record_scope_value NOT NULL,
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  resource_id uuid NOT NULL,
  key text NOT NULL UNIQUE,
  action text NOT NULL,
  description text NOT NULL,
  sensitivity sensitivity_value NOT NULL,
  status status_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE role_assignments (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL,
  role_id uuid NOT NULL,
  source_request_id uuid NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE field_policies (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  role_permission_id uuid NOT NULL,
  resource_field_id uuid NOT NULL,
  access_level access_level_value NOT NULL,
  revoked_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE resource_fields (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  resource_id uuid NOT NULL,
  field_key text NOT NULL,
  description text NOT NULL,
  sensitivity sensitivity_value NOT NULL,
  status status_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE access_resources (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  key text NOT NULL UNIQUE,
  description text NOT NULL,
  status status_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE organization_requests (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL,
  requested_by_account_id uuid NOT NULL,
  request_type request_type_value NOT NULL,
  request_status request_status_value NOT NULL,
  reason text NULL,
  submitted_at timestamptz NOT NULL,
  applied_at timestamptz NULL,
  notice_sent_on date NULL,
  last_working_on date NULL,
  proposed_probation_end_on date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL,
  probation_outcome probation_outcome_value NULL
);

CREATE TABLE role_change_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  request_id uuid NOT NULL,
  role_id uuid NOT NULL,
  operation operation_value NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE delegations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  delegator_employee_id uuid NOT NULL,
  delegate_employee_id uuid NOT NULL,
  scope scope_value NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  status status_value NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE organization_approval_steps (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  request_id uuid NOT NULL,
  step_order integer NOT NULL,
  assigned_employee_id uuid NOT NULL,
  acted_by_account_id uuid NULL,
  delegation_id uuid NULL,
  step_kind step_kind_value NOT NULL,
  decision decision_value NOT NULL,
  decided_at timestamptz NULL,
  decision_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE profile_change_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  request_id uuid NOT NULL,
  resource_field_id uuid NOT NULL,
  proposed_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  actor_account_id uuid NULL,
  subject_employee_id uuid NULL,
  action_key text NOT NULL,
  resource_key text NOT NULL,
  record_id uuid NULL,
  occurred_at timestamptz NOT NULL,
  before_values jsonb NULL,
  after_values jsonb NULL,
  source_ip inet NULL,
  device_label text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

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

ALTER TABLE employees ADD CHECK (reporting_boss_id IS DISTINCT FROM id), ADD CHECK (gross_salary >= 0),

  ADD CHECK (email = lower(btrim(email)));

ALTER TABLE shifts ADD CHECK (starts_at <> ends_at);

ALTER TABLE delegations ADD CHECK (starts_on <= ends_on), ADD CHECK (delegator_employee_id <> delegate_employee_id);

ALTER TABLE role_assignments ADD CHECK (valid_to IS NULL OR valid_to > valid_from);

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

ALTER TABLE role_assignments ADD EXCLUDE USING gist (

  employee_id WITH =, role_id WITH =, tstzrange(valid_from, valid_to, '[)') WITH &&

);

ALTER TABLE login_sessions ADD CHECK (

  (session_status = 'active' AND ended_at IS NULL AND end_reason IS NULL) OR

  (session_status = 'ended' AND ended_at IS NOT NULL AND end_reason IS NOT NULL)

), ADD CHECK (last_active_at >= started_at);

CREATE UNIQUE INDEX one_active_session ON login_sessions(user_account_id) WHERE session_status = 'active';

CREATE UNIQUE INDEX one_live_refresh ON refresh_tokens(session_id) WHERE consumed_at IS NULL AND revoked_at IS NULL;

CREATE UNIQUE INDEX one_active_grant ON role_permissions(role_id,permission_id,record_scope) WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX one_active_field_policy ON field_policies(role_permission_id,resource_field_id) WHERE revoked_at IS NULL;

ALTER TABLE resource_fields ADD UNIQUE(resource_id,field_key);

ALTER TABLE organization_approval_steps ADD UNIQUE(request_id,step_order), ADD CHECK (step_order > 0);

ALTER TABLE role_change_items ADD UNIQUE(request_id,role_id);

ALTER TABLE profile_change_items ADD UNIQUE(request_id,resource_field_id);

CREATE INDEX employees_boss ON employees(reporting_boss_id);

CREATE INDEX employee_docs_owner ON employee_documents(employee_id);

CREATE INDEX audit_by_time ON audit_events(occurred_at DESC,id);

CREATE INDEX org_request_employee ON organization_requests(employee_id,submitted_at DESC);

CREATE INDEX delegation_lookup ON delegations(delegator_employee_id,delegate_employee_id,starts_on,ends_on);

CREATE FUNCTION prevent_audit_edits() RETURNS trigger LANGUAGE plpgsql AS $$

BEGIN

  RAISE EXCEPTION 'Audit records are append-only';

END;

$$;

CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON audit_events

FOR EACH ROW EXECUTE FUNCTION prevent_audit_edits();
