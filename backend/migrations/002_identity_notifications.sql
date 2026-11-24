CREATE TABLE identity_notifications (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  request_id uuid NOT NULL REFERENCES organization_requests(id),
  event_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES user_accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES user_accounts(id)
);
CREATE INDEX identity_notifications_inbox ON identity_notifications(employee_id,created_at DESC,id);
