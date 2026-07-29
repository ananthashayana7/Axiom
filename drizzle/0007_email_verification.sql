-- Add email verification fields to suppliers table
ALTER TABLE suppliers ADD COLUMN email_verified boolean DEFAULT false NOT NULL;
ALTER TABLE suppliers ADD COLUMN email_verification_token text;
ALTER TABLE suppliers ADD COLUMN email_verification_expires_at timestamp;

-- Create index for faster verification token lookups
CREATE INDEX supplier_email_verification_token_idx ON suppliers(email_verification_token);
