ALTER TABLE courses ADD COLUMN deleted_at INTEGER;
ALTER TABLE lectures ADD COLUMN audio_source TEXT NOT NULL DEFAULT 'microphone';
ALTER TABLE transcript_segments ADD COLUMN provider TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE transcript_segments ADD COLUMN status TEXT NOT NULL DEFAULT 'final';
ALTER TABLE transcript_segments ADD COLUMN transcript_version TEXT NOT NULL DEFAULT 'original';
CREATE TABLE local_models (
 id TEXT PRIMARY KEY, revision TEXT NOT NULL, runtime_version TEXT NOT NULL,
 sha256 TEXT NOT NULL, size_bytes INTEGER NOT NULL, installed_at INTEGER NOT NULL
);
CREATE INDEX courses_trash ON courses(deleted_at);
CREATE TABLE transcript_edits (
 id INTEGER PRIMARY KEY, segment_id TEXT NOT NULL, lecture_id TEXT NOT NULL,
 source_text TEXT NOT NULL, translated_text TEXT NOT NULL,
 provider TEXT NOT NULL, transcript_version TEXT NOT NULL, edited_at INTEGER NOT NULL
);
CREATE TRIGGER preserve_transcript_before_correction BEFORE UPDATE OF source_text ON transcript_segments
WHEN OLD.source_text != NEW.source_text BEGIN
 INSERT INTO transcript_edits(segment_id,lecture_id,source_text,translated_text,provider,transcript_version,edited_at)
 VALUES(OLD.id,OLD.lecture_id,OLD.source_text,OLD.translated_text,OLD.provider,OLD.transcript_version,unixepoch());
END;
