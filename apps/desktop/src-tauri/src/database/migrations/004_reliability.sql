-- foreign_keys is disabled by the migration runner, outside the transaction.
-- Rebuild the original CHECK constraint, retaining all rows and child records.
DROP TRIGGER switch_translation_language;
CREATE TABLE transcript_segments_new (
 id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
 start_seconds REAL NOT NULL CHECK(start_seconds>=0),
 end_seconds REAL NOT NULL CHECK(end_seconds>=start_seconds),
 source_text TEXT NOT NULL, translated_text TEXT NOT NULL DEFAULT '',
 origin TEXT NOT NULL CHECK(origin IN ('manual','cloud','local')),
 provider TEXT NOT NULL DEFAULT 'legacy', status TEXT NOT NULL DEFAULT 'final',
 transcript_version TEXT NOT NULL DEFAULT 'original', revision INTEGER NOT NULL DEFAULT 0
);
INSERT INTO transcript_segments_new SELECT id,lecture_id,start_seconds,end_seconds,source_text,translated_text,
 CASE WHEN origin='cloud' AND provider='local' THEN 'local' ELSE origin END,
 provider,status,transcript_version,revision FROM transcript_segments;
DROP TABLE transcript_segments;
ALTER TABLE transcript_segments_new RENAME TO transcript_segments;
CREATE INDEX transcript_lecture_time ON transcript_segments(lecture_id,start_seconds);
CREATE TRIGGER preserve_transcript_before_correction BEFORE UPDATE OF source_text ON transcript_segments
WHEN OLD.source_text!=NEW.source_text BEGIN
 INSERT INTO transcript_edits(segment_id,lecture_id,source_text,translated_text,provider,transcript_version,edited_at)
 VALUES(OLD.id,OLD.lecture_id,OLD.source_text,OLD.translated_text,OLD.provider,OLD.transcript_version,unixepoch()); END;
CREATE TRIGGER retain_translation AFTER UPDATE OF translated_text ON transcript_segments WHEN NEW.translated_text!=''
BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
CREATE TRIGGER retain_inserted_translation AFTER INSERT ON transcript_segments WHEN NEW.translated_text!=''
BEGIN INSERT INTO translation_versions SELECT NEW.id,NEW.revision,c.assistance_language,NEW.translated_text FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=NEW.lecture_id ON CONFLICT(segment_id,revision,language) DO UPDATE SET body=excluded.body; END;
CREATE TRIGGER switch_translation_language AFTER UPDATE OF assistance_language ON courses WHEN OLD.assistance_language!=NEW.assistance_language
BEGIN UPDATE transcript_segments SET translated_text=COALESCE((SELECT body FROM translation_versions v WHERE v.segment_id=transcript_segments.id AND v.revision=transcript_segments.revision AND v.language=NEW.assistance_language),'') WHERE lecture_id IN (SELECT id FROM lectures WHERE course_id=NEW.id); END;

CREATE TABLE review_checkpoints (
 id TEXT PRIMARY KEY, lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
 payload TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX review_lecture ON review_checkpoints(lecture_id,updated_at DESC);
CREATE TABLE cleanup_commits (id TEXT PRIMARY KEY);
