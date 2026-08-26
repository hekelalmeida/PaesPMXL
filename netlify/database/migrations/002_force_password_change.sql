ALTER TABLE paes_users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE paes_users
SET must_change_password = FALSE
WHERE login = 'HSA';
