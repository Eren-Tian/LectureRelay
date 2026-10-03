use crate::audio::wav::encode_chunk;
use crate::{
    AppState,
    domain::*,
    error::{AppResult, UserFacing},
    providers::{Provider, Role, configured_text},
};

pub fn course_context(state: &AppState, course: &Course) -> AppResult<String> {
    let glossary = state
        .storage
        .glossary(&course.id)?
        .into_iter()
        .map(|term| format!("{} = {}", term.source, term.translation))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(format!(
        "Course: {} ({})\nSubject: {}\nDescription: {}\nGlossary:\n{}",
        course.name, course.code, course.subject, course.description, glossary
    )
    .chars()
    .take(14000)
    .collect())
}

pub async fn transcribe(state: &AppState, id: &str, translate: bool) -> AppResult<()> {
    let detail = state.storage.detail(id)?;
    if detail.lecture.status == "recording" {
        return Err("Stop and save the recording before transcription.".into());
    }
    let provider = crate::speech::configured(state, &detail.course.id)?;
    let settings = state.storage.settings()?;
    let speech_provider = if settings.speech_provider == "none" {
        &settings.provider
    } else {
        &settings.speech_provider
    };
    let _capabilities = provider.capabilities();
    let context = course_context(state, &detail.course)?;
    let path = state.paths.recording(&detail.course.id, id)?;
    let mut reader = hound::WavReader::open(path)
        .user_error("Audio cannot be read. The recording may not have completed normally.")?;
    let spec = reader.spec();
    if spec.sample_rate == 0
        || spec.sample_rate > 384000
        || spec.channels != 1
        || spec.bits_per_sample != 16
        || spec.sample_format != hound::SampleFormat::Int
    {
        return Err("This recording format is not supported for transcription.".into());
    }
    let rate = spec.sample_rate;
    let total_samples = reader.duration();
    let mut offset =
        ((detail.lecture.transcribed_until * rate as f64).round() as u32).min(total_samples);
    reader
        .seek(offset)
        .user_error("Cannot resume transcription.")?;
    let chunk_size = (rate * 30).min(6 * 1024 * 1024);
    let total = (total_samples - offset).div_ceil(chunk_size);
    let mut completed = 0;
    state.jobs.progress(completed, total);
    while offset < total_samples {
        state.jobs.checkpoint()?;
        let samples: Vec<i16> = reader
            .samples::<i16>()
            .take(chunk_size as usize)
            .collect::<hound::Result<_>>()
            .user_error("Cannot read recording.")?;
        if samples.is_empty() {
            break;
        }
        let duration = samples.len() as f64 / rate as f64;
        let wav = encode_chunk(&samples, spec)?;
        let response = provider.transcribe(wav, &context).await?;
        state.jobs.checkpoint()?;
        let start_offset = offset as f64 / rate as f64;
        let segments: Vec<_> = response
            .into_iter()
            .filter(|segment| !segment.text.trim().is_empty())
            .map(|segment| {
                if !segment.start.is_finite()
                    || !segment.end.is_finite()
                    || segment.end < segment.start
                    || segment.text.len() > 10000
                {
                    return Err(
                        "Invalid transcription timestamps or text. Saved content is preserved."
                            .into(),
                    );
                }
                let start = segment.start.clamp(0.0, duration);
                let end = segment.end.clamp(start, duration);
                Ok(TranscriptSegment {
                    id: new_id(),
                    lecture_id: id.into(),
                    start_seconds: start_offset + start,
                    end_seconds: start_offset + end,
                    source_text: segment.text.trim().into(),
                    translated_text: String::new(),
                    origin: if settings.speech_provider == "local" {
                        "local"
                    } else {
                        "cloud"
                    }
                    .into(),
                    provider: speech_provider.clone(),
                    status: "final".into(),
                    transcript_version: "postclass".into(),
                    revision: 0,
                })
            })
            .collect::<AppResult<_>>()?;
        offset += samples.len() as u32;
        state
            .storage
            .append_cloud_chunk(id, &segments, offset as f64 / rate as f64)?;
        state.storage.snapshot(&state.paths, id)?;
        if translate && !segments.is_empty() {
            translate_batch(
                state,
                configured_text(state, Role::Translation, false)?.as_ref(),
                &context,
                &detail.course.assistance_language,
                id,
                &segments,
            )
            .await?;
        }
        completed += 1;
        state.jobs.progress(completed, total);
    }
    Ok(())
}

pub async fn translate_all(state: &AppState, id: &str) -> AppResult<()> {
    let detail = state.storage.detail(id)?;
    let provider = configured_text(state, Role::Translation, false)?;
    let context = course_context(state, &detail.course)?;
    let pending: Vec<_> = detail
        .segments
        .into_iter()
        .filter(|s| s.translated_text.is_empty())
        .collect();
    if pending.is_empty() {
        return Err("No English segments need translation.".into());
    }
    let batches = translation_batches(&pending);
    let total = batches.len() as u32;
    state.jobs.progress(0, total);
    for (index, batch) in batches.into_iter().enumerate() {
        state.jobs.checkpoint()?;
        translate_batch(
            state,
            provider.as_ref(),
            &context,
            &detail.course.assistance_language,
            id,
            &batch,
        )
        .await?;
        state.jobs.progress(index as u32 + 1, total);
    }
    Ok(())
}

fn translation_batches(segments: &[TranscriptSegment]) -> Vec<Vec<TranscriptSegment>> {
    let mut batches = Vec::new();
    let mut current = Vec::new();
    let mut size = 0;
    for segment in segments {
        if !current.is_empty() && (size + segment.source_text.len() > 6000 || current.len() >= 16) {
            batches.push(std::mem::take(&mut current));
            size = 0;
        }
        size += segment.source_text.len();
        current.push(segment.clone());
    }
    if !current.is_empty() {
        batches.push(current);
    }
    batches
}

async fn translate_batch(
    state: &AppState,
    provider: &dyn Provider,
    context: &str,
    language: &str,
    id: &str,
    segments: &[TranscriptSegment],
) -> AppResult<()> {
    for batch in translation_batches(segments) {
        state.jobs.checkpoint()?;
        let result = provider.translate(context, &batch, language).await?;
        state.jobs.checkpoint()?;
        for segment in &batch {
            let text = result
                .iter()
                .find(|entry| entry.id == segment.id)
                .map(|entry| entry.text.as_str())
                .filter(|text| !text.trim().is_empty() && text.len() <= 20000)
                .ok_or(
                    "Some translations are missing. English is preserved; run translation again.",
                )?;
            if !state.storage.translate_checked(segment, language, text)? {
                return Err(
                    "Transcript or target language changed. Old translations were discarded."
                        .into(),
                );
            }
        }
        state.storage.snapshot(&state.paths, id)?;
    }
    Ok(())
}

pub async fn notes(state: &AppState, id: &str) -> AppResult<()> {
    review(state, id, "").await
}

pub async fn review(state: &AppState, id: &str, request: &str) -> AppResult<()> {
    super::review::run(state, id, request, None).await
}

pub async fn answer(state: &AppState, id: &str, question: &str) -> AppResult<Answer> {
    let question = question.trim();
    if question.is_empty() || question.len() > 2000 {
        return Err("Enter a question of no more than 2,000 characters.".into());
    }
    let detail = state.storage.detail(id)?;
    if detail.segments.is_empty() {
        return Err("A transcript is needed to answer from lecture evidence.".into());
    }
    let provider = configured_text(state, Role::Study, false)?;
    let context = course_context(state, &detail.course)?;
    let sources = select_evidence(&detail.segments, question);
    if sources.is_empty() {
        return Err(
            "Split long transcript segments into shorter sections before asking a question.".into(),
        );
    }
    let evidence = sources
        .iter()
        .enumerate()
        .map(|(index, s)| {
            format!(
                "[S{}] [{}] {}\nTranslation: {}",
                index + 1,
                timestamp(s.start_seconds),
                s.source_text,
                s.translated_text
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    state.jobs.checkpoint()?;
    let response = provider
        .answer(
            &context,
            &evidence,
            question,
            &detail.course.assistance_language,
        )
        .await?;
    state.jobs.checkpoint()?;
    let answer = Answer {
        id: new_id(),
        question: question.into(),
        answer: response,
        sources,
        created_at: now(),
    };
    state.storage.save_answer(id, &answer)?;
    Ok(answer)
}

pub fn select_evidence(segments: &[TranscriptSegment], question: &str) -> Vec<TranscriptSegment> {
    if segments
        .iter()
        .map(|s| s.source_text.len() + s.translated_text.len())
        .sum::<usize>()
        <= 10000
    {
        return segments.to_vec();
    }
    let tokens: Vec<_> = question
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|token| token.chars().count() >= 2)
        .map(str::to_owned)
        .collect();
    let mut scored: Vec<_> = segments
        .iter()
        .enumerate()
        .map(|(index, s)| {
            let text = format!("{} {}", s.source_text, s.translated_text).to_lowercase();
            let score = tokens
                .iter()
                .filter(|token| text.contains(token.as_str()))
                .count();
            (score, index, s)
        })
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
    let mut selected = if scored.first().is_some_and(|item| item.0 > 0) {
        scored
            .into_iter()
            .filter(|item| item.0 > 0)
            .take(16)
            .map(|(_, index, s)| (index, s))
            .collect::<Vec<_>>()
    } else {
        segments
            .iter()
            .enumerate()
            .step_by(segments.len().div_ceil(12).max(1))
            .collect::<Vec<_>>()
    };
    selected.sort_by_key(|(index, _)| *index);
    let mut size = 0;
    selected
        .into_iter()
        .take_while(|(_, s)| {
            size += s.source_text.len() + s.translated_text.len();
            size <= 10000
        })
        .map(|(_, s)| s.clone())
        .collect()
}

pub fn timestamp(seconds: f64) -> String {
    let total = seconds.max(0.0) as u64;
    format!("{:02}:{:02}", total / 60, total % 60)
}

#[cfg(test)]
mod tests {
    #[test]
    fn chunk_has_valid_wav_header_and_exact_duration() {
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };
        let bytes = super::encode_chunk(&vec![100_i16; 32000], spec).unwrap();
        let reader = hound::WavReader::new(std::io::Cursor::new(bytes)).unwrap();
        assert_eq!(reader.duration(), 32000);
        assert_eq!(reader.spec().sample_rate, 16000);
    }
    #[test]
    fn evidence_retrieval_finds_late_lecture_term_and_keeps_original_ids() {
        let mut segments = Vec::new();
        for index in 0..100 {
            segments.push(crate::domain::TranscriptSegment {
                id: index.to_string(),
                lecture_id: "lecture".into(),
                start_seconds: index as f64,
                end_seconds: index as f64 + 1.0,
                source_text: "ordinary lecture material ".repeat(20),
                translated_text: String::new(),
                origin: "cloud".into(),
                provider: "legacy".into(),
                status: "final".into(),
                transcript_version: "original".into(),
                revision: 0,
            });
        }
        segments[90].source_text = "Mitochondria produce ATP during cellular respiration.".into();
        let evidence = super::select_evidence(&segments, "How do mitochondria produce ATP?");
        assert!(evidence.iter().any(|s| s.id == "90"));
    }
}
