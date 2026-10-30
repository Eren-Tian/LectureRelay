-- Speaker labels that the student assigns to transcript segments.
-- Labels follow their segment: re-transcribing or deleting removes them.
CREATE TABLE segment_speakers (
 segment_id TEXT PRIMARY KEY REFERENCES transcript_segments(id) ON DELETE CASCADE,
 lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
 speaker TEXT NOT NULL CHECK(length(speaker) BETWEEN 1 AND 40)
);
CREATE INDEX segment_speakers_lecture ON segment_speakers(lecture_id);
