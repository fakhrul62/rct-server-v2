ALTER TABLE identity.otp_challenges
  ADD CONSTRAINT otp_failed_attempts_limit CHECK (failed_attempts <= 5),
  ADD CONSTRAINT otp_consumed_timestamp CHECK ((challenge_status = 'consumed') = (consumed_at IS NOT NULL));

CREATE UNIQUE INDEX one_pending_otp_per_purpose ON identity.otp_challenges(user_account_id,purpose)
WHERE challenge_status='pending' AND deleted_at IS NULL;
