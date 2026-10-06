//! Source-only classroom outline. No inference is scheduled while recording.
use crate::domain::TranscriptSegment;
use serde::Serialize;

const WINDOW: f64 = 120.0;
const SOURCE_LIMIT: usize = 6000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassroomSection {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub source: String,
    pub translation: String,
}

/// Whole finalized segments, in source order. Never discard an oversized segment.
/// The model's bounded output recovery can split that segment later.
pub(crate) fn classroom_sections(segments: &[TranscriptSegment]) -> Vec<ClassroomSection> {
    let mut sections: Vec<ClassroomSection> = Vec::new();
    for segment in segments {
        if segment.source_text.trim().is_empty() {
            continue;
        }
        let line = format!(
            "[{}] {}\n",
            crate::app::assistance::timestamp(segment.start_seconds),
            segment.source_text
        );
        let new_section = sections.last().is_none_or(|s| {
            segment.start_seconds - s.start_seconds >= WINDOW
                || s.source.len() + line.len() > SOURCE_LIMIT
        });
        if new_section {
            sections.push(ClassroomSection {
                start_seconds: segment.start_seconds,
                end_seconds: segment.end_seconds,
                source: String::new(),
                translation: String::new(),
            });
        }
        let section = sections.last_mut().expect("a section was created");
        section.end_seconds = section.end_seconds.max(segment.end_seconds);
        section.source.push_str(&line);
        if !segment.translated_text.trim().is_empty() {
            section.translation.push_str(&format!(
                "[{}] {}\n",
                crate::app::assistance::timestamp(segment.start_seconds),
                segment.translated_text
            ));
        }
    }
    sections
}
