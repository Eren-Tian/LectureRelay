//! Immutable input snapshots make later appends harmless and source edits detectable.
use super::Storage;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarySource {
    pub id: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub text: String,
    pub revision: i64,
}
impl From<&TranscriptSegment> for SummarySource {
    fn from(s: &TranscriptSegment) -> Self {
        Self {
            id: s.id.clone(),
            start_seconds: s.start_seconds,
            end_seconds: s.end_seconds,
            text: s.source_text.clone(),
            revision: s.revision,
        }
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SummaryPoint {
    pub text: String,
    pub source_ids: Vec<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryCard {
    pub id: String,
    pub lecture_id: String,
    pub provider: String,
    pub model: String,
    pub language: String,
    pub sources: Vec<SummarySource>,
    pub state: String,
    pub title: String,
    pub points: Vec<SummaryPoint>,
    pub message: String,
    pub created_at: i64,
}
fn current(db: &Connection, card: &SummaryCard) -> AppResult<bool> {
    let language: String = db.query_row("SELECT c.assistance_language FROM lectures l JOIN courses c ON c.id=l.course_id WHERE l.id=?1", [&card.lecture_id], |r|r.get(0)).user_error("Cannot read summary language.")?;
    if language != card.language {
        return Ok(false);
    }
    for source in &card.sources {
        // JSON f64 decoding may shift a timestamp by one ULP. A microsecond is
        // below one audio sample; text/revision still match exactly and actual
        // time corrections remain detectable.
        let matches: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM transcript_segments WHERE id=?1 AND lecture_id=?2 AND source_text=?3 AND revision=?4 AND abs(start_seconds-?5)<=0.000001 AND abs(end_seconds-?6)<=0.000001 AND status='final')", params![source.id,card.lecture_id,source.text,source.revision,source.start_seconds,source.end_seconds], |r|r.get(0)).user_error("Cannot check summary references.")?;
        if !matches {
            return Ok(false);
        }
    }
    Ok(true)
}
impl Storage {
    pub fn summary_cards(&self, lecture: &str) -> AppResult<Vec<SummaryCard>> {
        let db = self.lock()?;
        let mut query=db.prepare("SELECT id,lecture_id,provider,model,language,sources,state,title,points,message,created_at FROM live_summary_cards WHERE lecture_id=?1 ORDER BY created_at,rowid").user_error("Cannot read live summaries.")?;
        let mut cards = query
            .query_map([lecture], |r| {
                let sources: String = r.get(5)?;
                let points: String = r.get(8)?;
                Ok(SummaryCard {
                    id: r.get(0)?,
                    lecture_id: r.get(1)?,
                    provider: r.get(2)?,
                    model: r.get(3)?,
                    language: r.get(4)?,
                    sources: serde_json::from_str(&sources).map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            5,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?,
                    state: r.get(6)?,
                    title: r.get(7)?,
                    points: serde_json::from_str(&points).map_err(|e| {
                        rusqlite::Error::FromSqlConversionFailure(
                            8,
                            rusqlite::types::Type::Text,
                            Box::new(e),
                        )
                    })?,
                    message: r.get(9)?,
                    created_at: r.get(10)?,
                })
            })
            .user_error("Cannot read live summaries.")?
            .collect::<rusqlite::Result<Vec<_>>>()
            .user_error("Cannot read saved summary cards.")?;
        for card in &mut cards {
            if !current(&db, card)? {
                card.state = "stale".into();
                card.message = "The source text or assistance language changed. Summarize again and review it.".into();
                db.execute(
                    "UPDATE live_summary_cards SET state='stale',message=?2 WHERE id=?1",
                    params![card.id, card.message],
                )
                .user_error("Cannot mark an outdated summary.")?;
            }
        }
        Ok(cards)
    }
    pub fn reserve_summary(
        &self,
        lecture: &str,
        preferences: &LiveSummaryPreferences,
        sources: Vec<SummarySource>,
    ) -> AppResult<SummaryCard> {
        let language = self
            .course(&self.lecture(lecture)?.course_id)?
            .assistance_language;
        if sources.is_empty() {
            return Err("There is no newly finalized English yet.".into());
        }
        let unique: HashSet<_> = sources.iter().map(|s| s.id.as_str()).collect();
        if unique.len() != sources.len() {
            return Err("The summary sources are duplicated. Select them again.".into());
        }
        let card = SummaryCard {
            id: new_id(),
            lecture_id: lecture.into(),
            provider: preferences.provider.as_str().into(),
            model: preferences.model.clone(),
            language,
            sources,
            state: "running".into(),
            title: String::new(),
            points: vec![],
            message: String::new(),
            created_at: now(),
        };
        let mut db = self.lock()?;
        let tx = db.transaction().user_error("Cannot reserve a summary.")?;
        if !current(&tx, &card)? {
            return Err("The source text changed. Try again.".into());
        }
        let covered: HashSet<_> = {
            let mut query = tx
                .prepare("SELECT sources FROM live_summary_cards WHERE lecture_id=?1")
                .user_error("Cannot check summary coverage.")?;
            let texts = query
                .query_map([lecture], |r| r.get::<_, String>(0))
                .user_error("Cannot check summary coverage.")?
                .collect::<rusqlite::Result<Vec<_>>>()
                .user_error("Cannot check summary coverage.")?;
            let mut covered = HashSet::new();
            for text in texts {
                let sources: Vec<SummarySource> = serde_json::from_str(&text)
                    .user_error("Cannot check saved summary sources.")?;
                covered.extend(sources.into_iter().map(|s| s.id));
            }
            covered
        };
        if card.sources.iter().any(|s| covered.contains(&s.id)) {
            return Err(
                "This source text already has a summary. Check the existing card or retry.".into(),
            );
        }
        tx.execute("INSERT INTO live_summary_cards(id,lecture_id,provider,model,language,sources,state,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,'running',?7,?7)",params![card.id,lecture,card.provider,card.model,card.language,serde_json::to_string(&card.sources).user_error("Cannot encode summary sources.")?,card.created_at]).user_error("Cannot save summary input. No request was sent.")?;
        tx.commit().user_error("Cannot save summary input.")?;
        Ok(card)
    }
    pub fn retry_summary(
        &self,
        lecture: &str,
        id: &str,
        preferences: &LiveSummaryPreferences,
    ) -> AppResult<SummaryCard> {
        let mut card = self
            .summary_cards(lecture)?
            .into_iter()
            .find(|c| c.id == id)
            .ok_or("This summary card was not found.")?;
        if card.state == "running" {
            return Err("This section is being summarized. Please wait.".into());
        }
        let actual = self.segments(lecture)?;
        let mut sources = Vec::new();
        for old in &card.sources {
            let s = actual
                .iter()
                .find(|s| s.id == old.id && s.status == "final")
                .ok_or("The source text was deleted, so this summary cannot be retried.")?;
            sources.push(SummarySource::from(s));
        }
        card.sources = sources;
        card.provider = preferences.provider.as_str().into();
        card.model = preferences.model.clone();
        card.language = self
            .course(&self.lecture(lecture)?.course_id)?
            .assistance_language;
        self.lock()?.execute("UPDATE live_summary_cards SET sources=?2,provider=?3,model=?4,language=?5,state='running',message='',updated_at=?6 WHERE id=?1",params![id,serde_json::to_string(&card.sources).user_error("Cannot encode summary sources.")?,card.provider,card.model,card.language,now()]).user_error("Cannot retry summary.")?;
        card.state = "running".into();
        Ok(card)
    }
    pub fn finish_summary(
        &self,
        card: &SummaryCard,
        title: &str,
        points: &[SummaryPoint],
    ) -> AppResult<bool> {
        let mut db = self.lock()?;
        let tx = db.transaction().user_error("Cannot save live summary.")?;
        let matches = current(&tx, card)?;
        tx.execute("UPDATE live_summary_cards SET title=?2,points=?3,state=?4,message=?5,updated_at=?6 WHERE id=?1 AND state='running'",params![card.id,title,serde_json::to_string(points).user_error("Cannot encode summary.")?,if matches {"completed"} else {"stale"},if matches {""} else {"The source text changed, so the old result was not used as the latest summary. Try again."},now()]).user_error("Cannot save live summary.")?;
        tx.commit().user_error("Cannot save live summary.")?;
        Ok(matches)
    }
    pub fn summary_failed(&self, id: &str, state: &str, message: &str) -> AppResult<()> {
        self.lock()?.execute("UPDATE live_summary_cards SET state=?2,message=?3,updated_at=?4 WHERE id=?1 AND state='running'",params![id,state,message,now()]).user_error("Cannot save summary outcome.")?;
        Ok(())
    }
    pub fn summary_tested(&self, provider: CloudProvider, model: Option<&str>) -> AppResult<()> {
        let key = format!("summary-test/{provider}");
        if let Some(model) = model {
            self.lock()?.execute("INSERT INTO app_settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,model]).user_error("Cannot save connection test.")?;
        } else {
            self.lock()?
                .execute("DELETE FROM app_settings WHERE key=?1", [key])
                .user_error("Cannot clear connection test.")?;
        }
        Ok(())
    }
    pub fn summary_test_matches(&self, provider: CloudProvider, model: &str) -> AppResult<bool> {
        self.lock()?
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM app_settings WHERE key=?1 AND value=?2)",
                params![format!("summary-test/{provider}"), model],
                |r| r.get(0),
            )
            .user_error("Cannot read connection test.")
    }
}
