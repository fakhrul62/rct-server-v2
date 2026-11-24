ALTER TABLE employee_documents ADD COLUMN file_name text;
ALTER TABLE employee_documents ADD COLUMN content_type text;
ALTER TABLE employee_documents ADD COLUMN content_bytes bytea;
ALTER TABLE employee_documents ADD CONSTRAINT employee_document_file_complete CHECK (
  (content_bytes IS NULL AND file_name IS NULL AND content_type IS NULL) OR
  (content_bytes IS NOT NULL AND file_name IS NOT NULL AND content_type IN ('application/pdf','image/jpeg','image/png')
   AND octet_length(content_bytes) BETWEEN 1 AND 5242880)
);
