CREATE TABLE live_summary_cards (
 id TEXT PRIMARY KEY,
 lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
 provider TEXT NOT NULL,
 model TEXT NOT NULL,
 language TEXT NOT NULL,
 sources TEXT NOT NULL,
 state TEXT NOT NULL,
 title TEXT NOT NULL DEFAULT '',
 points TEXT NOT NULL DEFAULT '[]',
 message TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX live_summary_lecture ON live_summary_cards(lecture_id,created_at);
