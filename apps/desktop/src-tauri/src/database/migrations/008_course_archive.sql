-- Archived courses leave the sidebar and the main course list but keep all
-- their lectures; NULL means the course is active.
ALTER TABLE courses ADD COLUMN archived_at INTEGER;
