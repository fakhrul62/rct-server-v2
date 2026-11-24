CREATE SEQUENCE employee_code_sequence AS bigint;
CREATE FUNCTION next_employee_code() RETURNS text
LANGUAGE sql VOLATILE SET search_path = identity, pg_catalog AS $$
  SELECT 'RCT-' || lpad(n::text, greatest(4, length(n::text)), '0')
  FROM (SELECT nextval('employee_code_sequence') AS n) AS counter
$$;
ALTER TABLE employees ALTER COLUMN employee_code SET DEFAULT next_employee_code();
