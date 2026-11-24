CREATE TABLE identity.revoked_access_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  session_id bigint NOT NULL REFERENCES identity.login_sessions(id),
  token_jti uuid NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint REFERENCES identity.user_accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by bigint REFERENCES identity.user_accounts(id),
  deleted_at timestamptz
);
CREATE VIEW identity_live.revoked_access_tokens AS SELECT * FROM identity.revoked_access_tokens
WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;
CREATE TRIGGER prevent_delete BEFORE DELETE ON identity.revoked_access_tokens
FOR EACH ROW EXECUTE FUNCTION identity.prevent_identity_delete();
