use crate::{
    domain::{SegmentSpeaker, TranscriptSegment},
    error::{AppResult, UserFacing},
};
use std::fmt::Write as _;

fn stamp(ms: u64, vtt: bool) -> String {
    format!(
        "{:02}:{:02}:{:02}{}{:03}",
        ms / 3600000,
        ms / 60000 % 60,
        ms / 1000 % 60,
        if vtt { '.' } else { ',' },
        ms % 1000
    )
}
pub fn speaker_of<'a>(speakers: &'a [SegmentSpeaker], segment: &str) -> Option<&'a str> {
    speakers
        .iter()
        .find(|s| s.segment_id == segment)
        .map(|s| s.speaker.as_str())
}

/// Segments as JSON values, each with its speaker when one was assigned.
pub fn labelled(
    segments: &[TranscriptSegment],
    speakers: &[SegmentSpeaker],
) -> AppResult<Vec<serde_json::Value>> {
    segments
        .iter()
        .map(|segment| {
            let mut value = serde_json::to_value(segment)
                .user_error(crate::error::ErrorCode::CannotEncodeTranscriptExport)?;
            if let (Some(name), Some(object)) =
                (speaker_of(speakers, &segment.id), value.as_object_mut())
            {
                object.insert("speaker".into(), name.into());
            }
            Ok(value)
        })
        .collect()
}

pub fn subtitles(
    segments: &[TranscriptSegment],
    speakers: &[SegmentSpeaker],
    vtt: bool,
    language: &str,
) -> AppResult<String> {
    if !matches!(language, "source" | "translation" | "bilingual") {
        return Err(crate::error::ErrorCode::ChooseASubtitleLanguage.into());
    }
    let mut rows: Vec<_> = segments
        .iter()
        .filter(|s| {
            s.start_seconds.is_finite()
                && s.end_seconds.is_finite()
                && s.end_seconds > s.start_seconds
        })
        .collect();
    rows.sort_by(|a, b| a.start_seconds.total_cmp(&b.start_seconds));
    let mut output = if vtt {
        "WEBVTT\n\n".to_owned()
    } else {
        String::new()
    };
    let mut index = 0;
    for (i, s) in rows.iter().enumerate() {
        let start = (s.start_seconds.max(0.0) * 1000.0).round() as u64;
        let mut end = (s.end_seconds * 1000.0).round() as u64;
        if let Some(next) = rows.get(i + 1) {
            end = end.min((next.start_seconds.max(0.0) * 1000.0).round() as u64);
        }
        if end <= start {
            continue;
        }
        let text = match language {
            "source" => s.source_text.clone(),
            "translation" => s.translated_text.clone(),
            _ => format!("{}\n{}", s.source_text, s.translated_text),
        };
        let text = match speaker_of(speakers, &s.id) {
            Some(name) => format!("{name}: {text}"),
            None => text,
        };
        let text = text
            .replace('\r', "")
            .replace("-->", "→")
            .replace('<', "‹")
            .replace('>', "›");
        let text = text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .collect::<Vec<_>>()
            .join("\n");
        if text.trim().is_empty() {
            continue;
        }
        index += 1;
        // Writing to a String cannot fail.
        let _ = write!(
            output,
            "{index}\n{} --> {}\n{text}\n\n",
            stamp(start, vtt),
            stamp(end, vtt)
        );
    }
    if index == 0 {
        return Err(crate::error::ErrorCode::NoSubtitlesAreAvailableInThisLanguage.into());
    }
    Ok(output)
}
