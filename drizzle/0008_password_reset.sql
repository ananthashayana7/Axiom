-- Add password reset fields to users table
ALTER TABLE users ADD COLUMN reset_token text;
ALTER TABLE users ADD COLUMN reset_token_expires_at timestamp;

-- Create index for faster reset token lookups
CREATE INDEX user_reset_token_idx ON users(reset_token);
