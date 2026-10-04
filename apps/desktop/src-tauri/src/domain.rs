use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Course {
    pub id: String,
    pub name: String,
    pub code: String,
    pub subject: String,
    pub description: String,
    pub assistance_language: String,
    pub created_at: i64,
    pub lecture_count: i64,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseInput {
    pub name: String,
    pub code: String,
    pub subject: String,
    pub description: String,
    pub assistance_language: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lecture {
    pub id: String,
    pub course_id: String,
    pub title: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_seconds: f64,
    pub status: String,
    pub recording_path: String,
    pub transcribed_until: f64,
    pub audio_source: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptSegment {
    pub id: String,
    pub lecture_id: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub source_text: String,
    pub translated_text: String,
    pub origin: String,
    #[serde(default = "legacy_provider")]
    pub provider: String,
    #[serde(default = "final_status")]
    pub status: String,
    #[serde(default = "original_version")]
    pub transcript_version: String,
    #[serde(default)]
    pub revision: i64,
}

fn legacy_provider() -> String {
    "legacy".into()
}
fn final_status() -> String {
    "final".into()
}
fn original_version() -> String {
    "original".into()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentInput {
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub source_text: String,
    pub translated_text: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlossaryTerm {
    pub id: String,
    pub course_id: String,
    pub source: String,
    pub translation: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub body: String,
    pub updated_at: i64,
    pub origin: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub id: String,
    pub question: String,
    pub answer: String,
    pub sources: Vec<TranscriptSegment>,
    pub created_at: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LectureDetail {
    pub recording_warning: Option<String>,
    pub lecture: Lecture,
    pub course: Course,
    pub segments: Vec<TranscriptSegment>,
    pub note: Option<Note>,
    pub answers: Vec<Answer>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppSettings {
    pub theme: String,
    pub quiet_mode: bool,
    pub assistance_language: String,
    pub provider: String,
    pub chat_model: String,
    pub translation_mode: String,
    pub translation_model: String,
    pub study_mode: String,
    pub speech_provider: String,
    pub local_model: String,
    pub audio_source: String,
    pub microphone_device_id: String,
    pub system_device_id: String,
    pub live_translation: bool,
    pub english_font_size: u32,
    pub translation_font_size: u32,
    pub show_english: bool,
    pub show_translation: bool,
    pub auto_scroll: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "light".into(),
            quiet_mode: true,
            assistance_language: "zh".into(),
            provider: "none".into(),
            chat_model: "gpt-4o-mini".into(),
            translation_mode: "local".into(),
            translation_model: "hy-mt2-1.8b".into(),
            study_mode: "local".into(),
            speech_provider: "none".into(),
            local_model: "nemotron-streaming".into(),
            audio_source: "microphone".into(),
            microphone_device_id: String::new(),
            system_device_id: String::new(),
            live_translation: true,
            english_font_size: 22,
            translation_font_size: 18,
            show_english: true,
            show_translation: true,
            auto_scroll: true,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub provider: String,
    pub has_key: bool,
    pub masked_key: String,
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn valid_language(language: &str) -> bool {
    matches!(language, "zh" | "ja" | "ko")
}
