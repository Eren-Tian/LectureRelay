use crate::{domain::TranscriptSegment, error::AppResult};

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
pub fn subtitles(segments: &[TranscriptSegment], vtt: bool, language: &str) -> AppResult<String> {
    if !matches!(language, "source" | "translation" | "bilingual") {
        return Err("Choose a subtitle language.".into());
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
        output.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            index,
            stamp(start, vtt),
            stamp(end, vtt),
            text
        ));
    }
    if index == 0 {
        return Err("No subtitles are available in this language.".into());
    }
    Ok(output)
}
