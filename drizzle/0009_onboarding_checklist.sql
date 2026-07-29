-- Add onboarding fields to users table
ALTER TABLE users ADD COLUMN onboarding_completed boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN onboarding_completed_at timestamp;

-- Create index for finding incomplete onboarding
CREATE INDEX user_onboarding_completed_idx ON users(onboarding_completed);
