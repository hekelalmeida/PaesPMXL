CREATE TABLE IF NOT EXISTS paes_users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('developer','bordo','pmb','view')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paes_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES paes_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paes_sessions_token_hash ON paes_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_paes_sessions_expires_at ON paes_sessions(expires_at);

CREATE TABLE IF NOT EXISTS paes_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  revision BIGINT NOT NULL DEFAULT 0,
  state JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

INSERT INTO paes_state (id, revision, state)
VALUES (1, 0, NULL)
ON CONFLICT (id) DO NOTHING;
