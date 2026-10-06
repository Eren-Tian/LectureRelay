//! Persisted, source-bound review generation. Recording and manual notes are never modified.
use crate::{
    AppState,
    database::review::{ReviewCheckpoint, ReviewPart},
    domain::{ProcessingMode, new_id},
    error::{AppResult, UserFacing},
    providers::{NotesProvider, local},
};
use sha2::{Digest, Sha256};

const STALE: &str = "The transcript, course context, language or model changed. Saved sections remain available; start a new review to use the current source.";

pub(crate) fn fingerprint(state: &AppState, id: &str, request: &str) -> AppResult<String> {
    let detail = state.storage.detail(id)?;
    let settings = state.storage.settings()?;
    let source: Vec<_> = detail
        .segments
        .iter()
        .map(|s| {
            (
                &s.id,
                s.start_seconds,
                s.end_seconds,
                &s.source_text,
                s.revision,
            )
        })
        .collect();
    // Quiet Mode changes scheduling, not generation inputs. Never hash provider credentials.
    let input = serde_json::to_vec(&(
        "review-v2",
        request,
        &detail.lecture.title,
        source,
        super::assistance::course_context(state, &detail.course)?,
        state
            .storage
            .course(&detail.lecture.course_id)?
            .assistance_language,
        settings.study_mode,
        if settings.study_mode == ProcessingMode::Local {
            crate::models::catalog::STUDY
        } else {
            settings.provider.as_str()
        },
        if settings.study_mode == ProcessingMode::Cloud {
            &settings.chat_model
        } else {
            crate::models::catalog::get(crate::models::catalog::STUDY)?.sha256
        },
    ))
    .user_error("Cannot identify review source.")?;
    Ok(format!("{:x}", Sha256::digest(input)))
}

fn source_parts(lines: impl Iterator<Item = String>, limit: usize) -> Vec<ReviewPart> {
    let mut parts = Vec::new();
    let mut current = String::new();
    for line in lines {
        for piece in local::chunks(&line, limit) {
            if current.len() + piece.len() > limit && !current.is_empty() {
                parts.push(ReviewPart {
                    start_seconds: None,
                    end_seconds: None,
                    source: std::mem::take(&mut current),
                    depth: 0,
                    body: None,
                });
            }
            current.push_str(&piece);
        }
    }
    if !current.is_empty() {
        parts.push(ReviewPart {
            start_seconds: None,
            end_seconds: None,
            source: current,
            depth: 0,
            body: None,
        });
    }
    parts
}

/// Prefer a complete timestamped line; at the depth bound a failure remains resumable.
fn split(part: &ReviewPart) -> Option<[ReviewPart; 2]> {
    if part.depth >= 3 || part.source.chars().count() < 80 {
        return None;
    }
    let middle = part.source.len() / 2;
    let mut at = part
        .source
        .char_indices()
        .filter(|(i, ch)| *ch == '\n' && *i > middle / 2 && *i < middle + middle / 2)
        .min_by_key(|(i, _)| i.abs_diff(middle))
        .map(|(i, _)| i + 1)
        .unwrap_or(middle);
    while !part.source.is_char_boundary(at) {
        at -= 1;
    }
    Some(
        [&part.source[..at], &part.source[at..]].map(|source| ReviewPart {
            // A recovery chunk can share a spoken segment with its sibling.
            // Keep the parent evidence range rather than invent precise boundaries.
            start_seconds: part.start_seconds,
            end_seconds: part.end_seconds,
            source: source.into(),
            depth: part.depth + 1,
            body: None,
        }),
    )
}

pub async fn run(state: &AppState, id: &str, request: &str, resume: Option<&str>) -> AppResult<()> {
    if request.chars().count() > 2000 {
        return Err("Keep review instructions under 2,000 characters.".into());
    }
    let detail = state.storage.detail(id)?;
    if detail.segments.is_empty() {
        return Err("Add or generate a transcript first.".into());
    }
    let mut review = if let Some(saved) = resume {
        state.storage.review_checkpoint(id, saved)?
    } else {
        let settings = state.storage.settings()?;
        ReviewCheckpoint {
            id: new_id(),
            lecture_id: id.into(),
            fingerprint: fingerprint(state, id, request)?,
            request: request.into(),
            source_version: state.storage.source_version(id)?,
            language: state
                .storage
                .course(&detail.lecture.course_id)?
                .assistance_language,
            origin: if settings.study_mode == ProcessingMode::Local {
                "local"
            } else {
                "cloud"
            }
            .into(),
            parts: if request.trim().is_empty() {
                crate::database::outline::classroom_sections(&detail.segments)
                    .into_iter()
                    .map(|s| ReviewPart {
                        start_seconds: Some(s.start_seconds),
                        end_seconds: Some(s.end_seconds),
                        source: s.source,
                        depth: 0,
                        body: None,
                    })
                    .collect()
            } else {
                source_parts(
                    detail.segments.iter().map(|s| {
                        format!(
                            "[{}] {}\n",
                            super::assistance::timestamp(s.start_seconds),
                            s.source_text
                        )
                    }),
                    6000,
                )
            },
            levels: Vec::new(),
            recoveries: 0,
            state: "paused".into(),
            message: String::new(),
            published_version: None,
        }
    };
    if review.published_version.is_some() {
        return Ok(());
    }
    if review.fingerprint != fingerprint(state, id, &review.request)? {
        review.state = "stale".into();
        review.message = STALE.into();
        state.storage.save_review_checkpoint(&review)?;
        return Err(STALE.into());
    }
    review.state = "running".into();
    review.message.clear();
    state.storage.save_review_checkpoint(&review)?;
    let result = generate(
        state,
        &mut review,
        &detail.lecture.title,
        &detail.lecture.course_id,
    )
    .await;
    if let Err(error) = &result {
        review.state = if state.jobs.checkpoint().is_err() {
            "paused"
        } else if error == STALE {
            "stale"
        } else {
            "failed"
        }
        .into();
        review.message = error.clone();
        // Publication may have committed even if its following snapshot failed.
        if review.published_version.is_none() {
            state.storage.save_review_checkpoint(&review)?;
        }
    }
    result
}

async fn generate(
    state: &AppState,
    review: &mut ReviewCheckpoint,
    title: &str,
    course: &str,
) -> AppResult<()> {
    let provider = local::configured_text(state, local::Role::Study, false)?;
    let context = format!(
        "Requested focus: {}\n{}",
        review.request,
        super::assistance::course_context(state, &state.storage.course(course)?)?
    );
    let (id, request, expected) = (
        review.lecture_id.clone(),
        review.request.clone(),
        review.fingerprint.clone(),
    );
    let checkpoint = || {
        state.jobs.checkpoint()?;
        if expected == fingerprint(state, &id, &request)? {
            Ok(())
        } else {
            Err(STALE.into())
        }
    };
    let save = |saved: &ReviewCheckpoint| {
        state.storage.save_review_checkpoint(saved)?;
        let complete = saved.parts.iter().filter(|p| p.body.is_some()).count();
        state
            .jobs
            .progress(complete as u32, saved.parts.len() as u32 + 1);
        Ok(())
    };
    save(review)?;
    generate_sections(provider.as_ref(), review, &context, &checkpoint, &save).await?;
    combine_sections(provider.as_ref(), review, &context, &checkpoint, &save).await?;
    checkpoint()?;
    let overview = review
        .levels
        .last()
        .and_then(|v| v.first())
        .ok_or("Review assembly is incomplete.")?;
    let sections = review
        .parts
        .iter()
        .enumerate()
        .map(|(i, p)| {
            let heading = if review.language == "zh" {
                // i18n-exempt: generated study document content
                format!("第 {} 段", i + 1)
            } else {
                format!("Section {}", i + 1)
            };
            let time = p
                .start_seconds
                .map(|seconds| {
                    format!(" [{}](#t={seconds})", super::assistance::timestamp(seconds))
                })
                .unwrap_or_default();
            format!(
                "### {heading}{time}\n\n{}",
                p.body.as_deref().unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join("\n\n");
    let coverage = if review.language == "zh" {
        format!(
            // i18n-exempt: generated study document content
            "## 分段课堂要点\n\n已覆盖全部 {} 段原文。",
            review.parts.len()
        )
    } else {
        format!(
            "## Source section notes\n\nCoverage: {} of {} source sections.",
            review.parts.len(),
            review.parts.len()
        )
    };
    let body = format!("# {title}\n\n{overview}\n\n---\n\n{coverage}\n\n{sections}");
    // Course edits and publication share this gate; no mixed-version publish after validation.
    let _gate = state.lock_gate();
    checkpoint()?;
    state.storage.publish_review(review, &body)?;
    state.storage.snapshot(&state.paths, &review.lecture_id)?;
    state
        .jobs
        .progress(review.parts.len() as u32 + 1, review.parts.len() as u32 + 1);
    Ok(())
}

// The callbacks make cancellation, interrupted persistence, and retries testable without a model.
async fn generate_sections(
    provider: &dyn NotesProvider,
    review: &mut ReviewCheckpoint,
    context: &str,
    checkpoint: impl Fn() -> AppResult<()>,
    save: impl Fn(&ReviewCheckpoint) -> AppResult<()>,
) -> AppResult<()> {
    let mut index = 0;
    while index < review.parts.len() {
        checkpoint()?;
        if review.parts[index].body.is_some() {
            index += 1;
            continue;
        }
        match provider
            .notes(context, &review.parts[index].source, &review.language)
            .await
        {
            Ok(body) => {
                review.parts[index].body = Some(body);
                save(review)?;
                index += 1;
            }
            Err(error) if local::is_generation_limit(&error) => {
                let children = split(&review.parts[index]).ok_or("A small review section still exceeds the model limit. Saved sections are preserved; retry or simplify the requested focus.")?;
                review.parts.splice(index..=index, children);
                review.recoveries += 1;
                save(review)?;
            }
            Err(error) => return Err(error),
        }
    }
    Ok(())
}

async fn combine_sections(
    provider: &dyn NotesProvider,
    review: &mut ReviewCheckpoint,
    context: &str,
    checkpoint: impl Fn() -> AppResult<()>,
    save: impl Fn(&ReviewCheckpoint) -> AppResult<()>,
) -> AppResult<()> {
    if review.levels.is_empty() {
        review.levels.push(
            review
                .parts
                .iter()
                .map(|p| p.body.clone().ok_or("Source coverage is incomplete."))
                .collect::<Result<_, _>>()?,
        );
        save(review)?;
    }
    let mut level = 0;
    while review.levels[level].len() > 1 {
        if review.levels.len() == level + 1 {
            review.levels.push(Vec::new());
        }
        let count = review.levels[level].len().div_ceil(2);
        while review.levels[level + 1].len() < count {
            checkpoint()?;
            let offset = review.levels[level + 1].len() * 2;
            let children =
                &review.levels[level][offset..(offset + 2).min(review.levels[level].len())];
            let body = if children.len() == 1 {
                children[0].clone()
            } else {
                let input = children.join("\n\n---\n\n");
                match provider
                    .combine_notes(context, &input, &review.language)
                    .await
                {
                    Ok(body) => body,
                    Err(error) if local::is_generation_limit(&error) => {
                        review.recoveries += 1;
                        save(review)?;
                        // One bounded retry requests a smaller result, never accepts a cut-off response.
                        let concise = format!(
                            "Requested focus: Compression recovery. Produce at most FOUR short bullets, no introduction, conclusion or practice questions. Use at most 200 words or 400 CJK characters. Original request is secondary: {}",
                            review.request
                        );
                        provider
                            .combine_notes(&concise, &input, &review.language)
                            .await?
                    }
                    Err(error) => return Err(error),
                }
            };
            review.levels[level + 1].push(body);
            save(review)?;
        }
        level += 1;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::{
        Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    };
    struct Provider {
        calls: AtomicUsize,
        combine_calls: AtomicUsize,
        fail_combine: AtomicBool,
        limit: usize,
    }
    #[async_trait]
    impl NotesProvider for Provider {
        async fn notes(&self, _: &str, evidence: &str, _: &str) -> AppResult<String> {
            self.calls.fetch_add(1, Ordering::Relaxed);
            if evidence.len() > self.limit {
                return Err("Local AI reached its output limit. Completed review sections are saved; retry the remaining work.".into());
            }
            Ok(format!("saved {}", evidence.len()))
        }
        async fn combine_notes(&self, _: &str, _: &str, _: &str) -> AppResult<String> {
            let n = self.combine_calls.fetch_add(1, Ordering::Relaxed);
            if n == 1 && self.fail_combine.swap(false, Ordering::Relaxed) {
                return Err("controlled worker exit".into());
            }
            Ok("combined [00:00]".into())
        }
    }
    fn plan() -> ReviewCheckpoint {
        ReviewCheckpoint {
            id: new_id(),
            lecture_id: new_id(),
            fingerprint: "source".into(),
            request: "review".into(),
            source_version: "v1".into(),
            language: "zh".into(),
            origin: "local".into(),
            parts: source_parts(
                (0..12).map(|n| format!("[{n:02}:00] {}\n", "source 中文 ".repeat(30))),
                2000,
            ),
            levels: vec![],
            recoveries: 0,
            state: "running".into(),
            message: String::new(),
            published_version: None,
        }
    }
    #[test]
    fn limited_output_cancel_restart_and_combination_failure_reuse_complete_work() {
        tauri::async_runtime::block_on(async {
            let provider = Provider {
                calls: 0.into(),
                combine_calls: 0.into(),
                fail_combine: true.into(),
                limit: 950,
            };
            let mut review = plan();
            let source = review
                .parts
                .iter()
                .map(|p| p.source.as_str())
                .collect::<String>();
            let persisted = Mutex::new(String::new());
            let cancel = AtomicBool::new(false);
            let save = |r: &ReviewCheckpoint| {
                *persisted.lock().unwrap() = serde_json::to_string(r).unwrap();
                if r.parts.iter().any(|p| p.body.is_some()) {
                    cancel.store(true, Ordering::Relaxed);
                }
                Ok(())
            };
            let check = || {
                if cancel.load(Ordering::Relaxed) {
                    Err("cancelled".into())
                } else {
                    Ok(())
                }
            };
            assert_eq!(
                generate_sections(&provider, &mut review, "", check, save)
                    .await
                    .unwrap_err(),
                "cancelled"
            );
            assert!(review.recoveries > 0);
            review = serde_json::from_str(&persisted.lock().unwrap()).unwrap();
            let completed = review.parts.iter().filter(|p| p.body.is_some()).count();
            assert_eq!(completed, 1);
            let calls = provider.calls.load(Ordering::Relaxed);
            generate_sections(
                &provider,
                &mut review,
                "",
                || Ok(()),
                |r| {
                    *persisted.lock().unwrap() = serde_json::to_string(r).unwrap();
                    Ok(())
                },
            )
            .await
            .unwrap();
            assert_eq!(
                review
                    .parts
                    .iter()
                    .map(|p| p.source.as_str())
                    .collect::<String>(),
                source
            );
            assert!(review.parts.iter().all(|p| p.body.is_some()));
            assert!(provider.calls.load(Ordering::Relaxed) - calls < review.parts.len() * 2);
            assert!(
                combine_sections(
                    &provider,
                    &mut review,
                    "",
                    || Ok(()),
                    |r| {
                        *persisted.lock().unwrap() = serde_json::to_string(r).unwrap();
                        Ok(())
                    }
                )
                .await
                .is_err()
            );
            review = serde_json::from_str(&persisted.lock().unwrap()).unwrap();
            assert_eq!(review.levels[1].len(), 1);
            let retained = review.levels[1][0].clone();
            combine_sections(&provider, &mut review, "", || Ok(()), |_| Ok(()))
                .await
                .unwrap();
            assert_eq!(review.levels[1][0], retained);
            assert_eq!(review.levels.last().unwrap().len(), 1);
        });
    }
    #[test]
    fn output_recovery_is_bounded_and_never_saves_truncation() {
        tauri::async_runtime::block_on(async {
            let provider = Provider {
                calls: 0.into(),
                combine_calls: 0.into(),
                fail_combine: false.into(),
                limit: 0,
            };
            let mut review = plan();
            assert!(
                generate_sections(&provider, &mut review, "", || Ok(()), |_| Ok(()))
                    .await
                    .is_err()
            );
            assert!(provider.calls.load(Ordering::Relaxed) <= 4);
            assert!(review.parts.iter().all(|p| p.body.is_none()));
            assert!(review.parts.iter().all(|p| p.depth <= 3));
        });
    }
}
