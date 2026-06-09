CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  audio_url TEXT,
  transcription TEXT NOT NULL,
  supervisor_feedback TEXT NOT NULL,
  key_moments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  call_id INTEGER REFERENCES calls(id) ON DELETE CASCADE,
  manager_name TEXT NOT NULL,
  strengths TEXT NOT NULL,
  weaknesses TEXT NOT NULL,
  score INTEGER,
  score_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_manager_call
  ON submissions (call_id, manager_name);
