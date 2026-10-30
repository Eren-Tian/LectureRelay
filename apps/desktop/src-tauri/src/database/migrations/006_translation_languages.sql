-- foreign_keys is disabled by the migration runner, outside the transaction.
-- Widen the translation-language CHECK to the codes in domain::TRANSLATION_LANGUAGES.
-- Rows and child records are kept; triggers that name courses are rebuilt as in 004.
DROP TRIGGER switch_translation_language;
DROP TRIGGER retain_translation;
DROP TRIGGER retain_inserted_translation;
CREATE TABLE courses_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assistance_language TEXT NOT NULL CHECK (assistance_language IN (
    'zh','zh-Hant','ja','ko','vi','th','id','ms','hi','bn',
    'ur','ar','fa','tr','ru','uk','es','pt','fr','de'
  )),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
INSERT INTO courses_new(id,name,code,subject,description,assistance_language,created_at,deleted_at)
 SELECT id,name,code,subject,description,assistance_language,created_at,deleted_at FROM courses;
DROP TABLE courses;
ALTER TABLE courses_new RENAME TO courses;
CREATE INDEX courses_trash ON courses(deleted_at);
CREATE TRIGGER retain_translation AFTER UPDATE OF translated_text ON transcript_segments WHEN NEW.translated_text!=''
BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
CREATE TRIGGER retain_inserted_translation AFTER INSERT ON transcript_segments WHEN NEW.translated_text!=''
BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
CREATE TRIGGER switch_translation_language AFTER UPDATE OF assistance_language ON courses WHEN OLD.assistance_language!=NEW.assistance_language
BEGIN UPDATE transcript_segments SET translated_text=COALESCE((SELECT body FROM translation_versions v WHERE v.segment_id=transcript_segments.id AND v.revision=transcript_segments.revision AND v.language=NEW.assistance_language),'') WHERE lecture_id IN (SELECT id FROM lectures WHERE course_id=NEW.id); END;
