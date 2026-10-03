CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assistance_language TEXT NOT NULL CHECK (assistance_language IN ('zh','ja','ko')),
  created_at INTEGER NOT NULL
);
CREATE TABLE lectures (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('recording','completed','interrupted','failed')),
  recording_path TEXT NOT NULL,
  transcribed_until REAL NOT NULL DEFAULT 0
);
CREATE INDEX lectures_course_started ON lectures(course_id, started_at DESC);
CREATE TABLE transcript_segments (
  id TEXT PRIMARY KEY,
  lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  start_seconds REAL NOT NULL CHECK (start_seconds >= 0),
  end_seconds REAL NOT NULL CHECK (end_seconds >= start_seconds),
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL CHECK (origin IN ('manual','cloud'))
);
CREATE INDEX transcript_lecture_time ON transcript_segments(lecture_id, start_seconds);
CREATE TABLE notes (
  lecture_id TEXT PRIMARY KEY REFERENCES lectures(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  origin TEXT NOT NULL
);
CREATE TABLE glossary_terms (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  translation TEXT NOT NULL,
  UNIQUE(course_id, source)
);
CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE answers (
  id TEXT PRIMARY KEY,
  lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
