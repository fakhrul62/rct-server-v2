DROP VIEW identity_live.employees;

ALTER TABLE identity.employees ADD COLUMN first_name text, ADD COLUMN last_name text;
UPDATE identity.employees SET
  first_name=split_part(btrim(name),' ',1),
  last_name=nullif(ltrim(substr(btrim(name),length(split_part(btrim(name),' ',1))+1)), '');
ALTER TABLE identity.employees ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE identity.employees DROP COLUMN name;
ALTER TABLE identity.employees ADD COLUMN name text GENERATED ALWAYS AS
  (first_name || CASE WHEN last_name IS NULL THEN '' ELSE ' ' || last_name END) STORED;
ALTER TABLE identity.employees ADD CHECK (btrim(first_name) <> '');

CREATE VIEW identity_live.employees AS SELECT * FROM identity.employees
WHERE deleted_at IS NULL WITH LOCAL CHECK OPTION;

INSERT INTO identity.resource_fields(resource_id,field_key,description,sensitivity,status)
SELECT r.id,f.key,f.label,'public','active' FROM identity.access_resources r
CROSS JOIN (VALUES ('first_name','Employee first name'),('last_name','Employee last name')) f(key,label)
WHERE r.key='employee_profile' ON CONFLICT(resource_id,field_key) DO NOTHING;

INSERT INTO identity.field_policies(role_permission_id,resource_field_id,access_level,created_by,updated_by)
SELECT p.role_permission_id,f.id,p.access_level,p.created_by,p.updated_by
FROM identity.field_policies p JOIN identity.resource_fields old ON old.id=p.resource_field_id
JOIN identity.resource_fields f ON f.resource_id=old.resource_id AND f.field_key IN ('first_name','last_name')
WHERE old.field_key='name' AND p.revoked_at IS NULL AND p.deleted_at IS NULL
ON CONFLICT DO NOTHING;
