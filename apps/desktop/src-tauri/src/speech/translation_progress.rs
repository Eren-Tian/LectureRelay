use crate::{database::Storage, domain::TranscriptSegment, providers::Translation};
use serde::Serialize;

pub fn persist(
    storage: &Storage,
    _lecture: &str,
    batch: &[TranscriptSegment],
    translations: &[Translation],
    language: &str,
) -> Vec<(String, bool)> {
    batch
        .iter()
        .map(|segment| {
            let saved = translations
                .iter()
                .find(|value| value.id == segment.id)
                .filter(|value| !value.text.trim().is_empty() && value.text.len() <= 20000)
                .is_some_and(|value| {
                    storage
                        .translate_checked(segment, language, &value.text)
                        .unwrap_or(false)
                });
            (segment.id.clone(), saved)
        })
        .collect()
}

/// Session-only delivery state. Saved English is never removed by translation failures.
#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationProgress {
    pub enabled: bool,
    pub configured: bool,
    pub pending_ids: Vec<String>,
    pub deferred_ids: Vec<String>,
    pub message: Option<String>,
}

impl TranslationProgress {
    pub fn pending(&mut self, id: &str) {
        if !self.pending_ids.iter().any(|v| v == id) {
            self.pending_ids.push(id.into());
        }
    }

    pub fn complete(&mut self, id: &str, saved: bool) {
        self.pending_ids.retain(|v| v != id);
        if !saved && !self.deferred_ids.iter().any(|v| v == id) {
            self.deferred_ids.push(id.into());
            if self.deferred_ids.len() > 200 {
                self.deferred_ids.remove(0);
            }
        }
        if !self.deferred_ids.is_empty() {
            self.message = Some("Some translations need another try. Your English and audio are saved; retry from lecture replay.".into());
        }
    }

    pub fn finish(&mut self) {
        for id in std::mem::take(&mut self.pending_ids) {
            self.complete(&id, false);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{domain::*, storage::AppPaths};

    #[test]
    fn translated_captions_persist_by_id_and_preserve_english_for_all_target_languages() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../target/test-fixtures")
            .join(new_id());
        let paths = AppPaths::initialize(root.join("data"), root.join("library")).unwrap();
        let db = Storage::open(&paths.data.join("app.db")).unwrap();
        for (language, translation) in [
            ("zh", "线粒体产生能量。"),
            ("ja", "ミトコンドリアはエネルギーを作ります。"),
            ("ko", "미토콘드리아는 에너지를 만듭니다."),
        ] {
            let course = db
                .save_course(
                    None,
                    CourseInput {
                        name: "Translation fixture".into(),
                        code: String::new(),
                        subject: "Biology".into(),
                        description: String::new(),
                        assistance_language: language.into(),
                    },
                )
                .unwrap();
            let lecture = db.create_lecture(&paths, &course.id, "Fixture").unwrap();
            let segment = TranscriptSegment {
                id: new_id(),
                lecture_id: lecture.id.clone(),
                start_seconds: 0.0,
                end_seconds: 2.0,
                source_text: "Mitochondria produce energy.".into(),
                translated_text: String::new(),
                origin: "cloud".into(),
                provider: "local".into(),
                status: "final".into(),
                transcript_version: "live".into(),
                revision: 0,
            };
            db.append_cloud_chunk(&lecture.id, std::slice::from_ref(&segment), 2.0)
                .unwrap();
            let unknown = Translation {
                id: "unexpected-id".into(),
                text: "Must not be attached".into(),
            };
            assert!(
                !persist(
                    &db,
                    &lecture.id,
                    std::slice::from_ref(&segment),
                    &[unknown],
                    language
                )[0]
                .1
            );
            let result = persist(
                &db,
                &lecture.id,
                std::slice::from_ref(&segment),
                &[Translation {
                    id: segment.id.clone(),
                    text: translation.into(),
                }],
                language,
            );
            assert!(result[0].1);
            let saved = db.latest_segments(&lecture.id).unwrap();
            assert_eq!(saved[0].source_text, segment.source_text);
            assert_eq!(saved[0].translated_text, translation);
            assert!(
                !persist(
                    &db,
                    &lecture.id,
                    std::slice::from_ref(&segment),
                    &[Translation {
                        id: segment.id.clone(),
                        text: " ".into()
                    }],
                    language
                )[0]
                .1
            );
            // A database write failure is reported to delivery state, never swallowed.
            let mut failed_segment = segment.clone();
            failed_segment.id = new_id();
            failed_segment.start_seconds = 3.0;
            failed_segment.end_seconds = 4.0;
            db.append_cloud_chunk(&lecture.id, std::slice::from_ref(&failed_segment), 4.0)
                .unwrap();
            let connection = rusqlite::Connection::open(paths.data.join("app.db")).unwrap();
            connection.execute_batch("CREATE TRIGGER reject_translation BEFORE UPDATE OF translated_text ON transcript_segments BEGIN SELECT RAISE(FAIL, 'fixture'); END;").unwrap();
            assert!(
                !persist(
                    &db,
                    &lecture.id,
                    std::slice::from_ref(&failed_segment),
                    &[Translation {
                        id: failed_segment.id.clone(),
                        text: "Replacement".into()
                    }],
                    language
                )[0]
                .1
            );
            connection
                .execute_batch("DROP TRIGGER reject_translation;")
                .unwrap();
            assert_eq!(
                db.latest_segments(&lecture.id).unwrap()[0].translated_text,
                translation
            );
        }
        drop(db);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn delivery_failure_does_not_leave_a_caption_waiting_forever() {
        let mut progress = TranslationProgress::default();
        progress.pending("one");
        progress.pending("two");
        progress.complete("one", true);
        progress.complete("two", false);
        assert!(progress.pending_ids.is_empty());
        assert_eq!(progress.deferred_ids, ["two"]);
        assert!(progress.message.is_some());
    }

    #[test]
    fn shutdown_marks_unsent_work_and_bounds_failure_history() {
        let mut progress = TranslationProgress::default();
        for i in 0..220 {
            progress.pending(&i.to_string());
        }
        progress.finish();
        assert!(progress.pending_ids.is_empty());
        assert_eq!(progress.deferred_ids.len(), 200);
        assert_eq!(progress.deferred_ids.last().unwrap(), "219");
    }
}
