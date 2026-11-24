INSERT INTO resource_fields(resource_id,field_key,description,sensitivity,status)
SELECT id,'payment_details','Employee payout instructions','compensation','active'
FROM access_resources WHERE key='employee_profile' ON CONFLICT(resource_id,field_key) DO NOTHING;
