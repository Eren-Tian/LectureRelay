ALTER TABLE transcript_segments ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE translation_versions (
 segment_id TEXT NOT NULL REFERENCES transcript_segments(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, language TEXT NOT NULL, body TEXT NOT NULL,
 PRIMARY KEY(segment_id,revision,language)
);
INSERT INTO translation_versions SELECT s.id,s.revision,c.assistance_language,s.translated_text FROM transcript_segments s JOIN lectures l ON l.id=s.lecture_id JOIN courses c ON c.id=l.course_id WHERE s.translated_text!='';
CREATE TRIGGER retain_translation AFTER UPDATE OF translated_text ON transcript_segments WHEN NEW.translated_text!=''
BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
CREATE TRIGGER switch_translation_language AFTER UPDATE OF assistance_language ON courses WHEN OLD.assistance_language!=NEW.assistance_language
BEGIN UPDATE transcript_segments SET translated_text=COALESCE((SELECT body FROM translation_versions v WHERE v.segment_id=transcript_segments.id AND v.revision=transcript_segments.revision AND v.language=NEW.assistance_language),'') WHERE lecture_id IN (SELECT id FROM lectures WHERE course_id=NEW.id); END;
CREATE TABLE processing_tasks (
 id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), kind TEXT NOT NULL,
 language TEXT NOT NULL, state TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
 total INTEGER NOT NULL DEFAULT 0, message TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX tasks_lecture ON processing_tasks(lecture_id,created_at DESC);
CREATE TABLE note_versions (
 id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), body TEXT NOT NULL,
 origin TEXT NOT NULL, language TEXT NOT NULL, source_version TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE study_marks (
 id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id), seconds REAL NOT NULL,
 label TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('bookmark','chapter'))
);
CREATE TABLE note_drafts (lecture_id TEXT PRIMARY KEY REFERENCES lectures(id),body TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE course_documents (id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),name TEXT NOT NULL,path TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE lecture_pins (lecture_id TEXT PRIMARY KEY REFERENCES lectures(id));

CREATE TRIGGER retain_inserted_translation AFTER INSERT ON transcript_segments WHEN NEW.translated_text!='' BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
