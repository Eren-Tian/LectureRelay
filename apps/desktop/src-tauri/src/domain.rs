use serde::{Deserialize, Serialize};

/// A closed set of persisted/IPC string values. The listed strings are the
/// only wire format; serde and SQLite both use them, so stored data and the
/// TypeScript contracts stay unchanged while Rust matches become exhaustive.
macro_rules! string_enum {
    ($(#[$meta:meta])* $name:ident { $($(#[$vmeta:meta])* $variant:ident = $value:literal),+ $(,)? }) => {
        $(#[$meta])*
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
        pub enum $name { $($(#[$vmeta])* $variant),+ }
        impl $name {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
            pub fn parse(value: &str) -> Option<Self> {
                match value { $($value => Some(Self::$variant),)+ _ => None }
            }
        }
        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(self.as_str())
            }
        }
        impl Serialize for $name {
            fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
                serializer.serialize_str(self.as_str())
            }
        }
        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
                let value = std::borrow::Cow::<str>::deserialize(deserializer)?;
                Self::parse(&value)
                    .ok_or_else(|| serde::de::Error::unknown_variant(&value, &[$($value),+]))
            }
        }
        impl rusqlite::types::ToSql for $name {
            fn to_sql(&self) -> rusqlite::Result<rusqlite::types::ToSqlOutput<'_>> {
                Ok(self.as_str().into())
            }
        }
        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                Self::parse(value.as_str()?).ok_or(rusqlite::types::FromSqlError::InvalidType)
            }
        }
    };
}

string_enum!(Theme {
    Light = "light",
    Dark = "dark",
});

impl From<Theme> for tauri::Theme {
    fn from(theme: Theme) -> Self {
        match theme {
            Theme::Light => Self::Light,
            Theme::Dark => Self::Dark,
        }
    }
}

string_enum!(
    /// A cloud service called with the user's own API key.
    CloudProvider {
        OpenAi = "openai",
        Groq = "groq",
    }
);

impl CloudProvider {
    pub const ALL: [Self; 2] = [Self::OpenAi, Self::Groq];
}

string_enum!(
    /// An optional cloud service selection.
    CloudChoice {
        None = "none",
        OpenAi = "openai",
        Groq = "groq",
    }
);

impl From<CloudProvider> for CloudChoice {
    fn from(provider: CloudProvider) -> Self {
        match provider {
            CloudProvider::OpenAi => Self::OpenAi,
            CloudProvider::Groq => Self::Groq,
        }
    }
}

impl CloudChoice {
    pub fn cloud(self) -> Option<CloudProvider> {
        match self {
            Self::None => None,
            Self::OpenAi => Some(CloudProvider::OpenAi),
            Self::Groq => Some(CloudProvider::Groq),
        }
    }
}

string_enum!(
    /// Where live and postclass English transcription runs.
    SpeechEngine {
        None = "none",
        Local = "local",
        OpenAi = "openai",
        Groq = "groq",
    }
);

impl SpeechEngine {
    pub fn cloud(self) -> Option<CloudProvider> {
        match self {
            Self::None | Self::Local => None,
            Self::OpenAi => Some(CloudProvider::OpenAi),
            Self::Groq => Some(CloudProvider::Groq),
        }
    }
}

string_enum!(
    /// Where translation or study text processing runs.
    ProcessingMode {
        Local = "local",
        Cloud = "cloud",
        None = "none",
    }
);

string_enum!(
    /// A device class that can be recorded live.
    #[derive(Default)]
    InputSource {
        #[default]
        Microphone = "microphone",
        System = "system",
    }
);

string_enum!(
    /// How a lecture's audio was obtained.
    LectureSource {
        Microphone = "microphone",
        System = "system",
        Import = "import",
    }
);

impl From<InputSource> for LectureSource {
    fn from(source: InputSource) -> Self {
        match source {
            InputSource::Microphone => Self::Microphone,
            InputSource::System => Self::System,
        }
    }
}

string_enum!(
    /// Who produced a transcript segment's English text.
    SegmentOrigin {
        Manual = "manual",
        Cloud = "cloud",
        Local = "local",
    }
);

string_enum!(LectureStatus {
    Recording = "recording",
    Completed = "completed",
    Interrupted = "interrupted",
    Failed = "failed",
});

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
    pub status: LectureStatus,
    pub recording_path: String,
    pub transcribed_until: f64,
    pub audio_source: LectureSource,
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
    pub origin: SegmentOrigin,
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
    pub theme: Theme,
    pub quiet_mode: bool,
    pub assistance_language: String,
    pub provider: CloudChoice,
    pub chat_model: String,
    pub translation_mode: ProcessingMode,
    pub translation_model: String,
    pub study_mode: ProcessingMode,
    pub speech_provider: SpeechEngine,
    pub local_model: String,
    pub audio_source: InputSource,
    pub microphone_device_id: String,
    pub system_device_id: String,
    pub live_translation: bool,
    pub english_font_size: u32,
    pub translation_font_size: u32,
    pub show_english: bool,
    pub show_translation: bool,
    pub auto_scroll: bool,
    pub live_summaries: LiveSummaryPreferences,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: Theme::Light,
            quiet_mode: true,
            assistance_language: "zh".into(),
            provider: CloudChoice::None,
            chat_model: "gpt-4o-mini".into(),
            translation_mode: ProcessingMode::Local,
            translation_model: "hy-mt2-1.8b".into(),
            study_mode: ProcessingMode::Local,
            speech_provider: SpeechEngine::None,
            local_model: "nemotron-streaming".into(),
            audio_source: InputSource::Microphone,
            microphone_device_id: String::new(),
            system_device_id: String::new(),
            live_translation: true,
            english_font_size: 22,
            translation_font_size: 18,
            show_english: true,
            show_translation: true,
            auto_scroll: true,
            live_summaries: LiveSummaryPreferences::default(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub provider: CloudProvider,
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

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", default)]
pub struct LiveSummaryPreferences {
    pub enabled: bool,
    pub provider: CloudChoice,
    pub model: String,
    pub interval_minutes: u32,
    pub upload_consent: bool,
}
impl Default for LiveSummaryPreferences {
    fn default() -> Self {
        Self {
            enabled: false,
            provider: CloudChoice::Groq,
            model: "openai/gpt-oss-120b".into(),
            interval_minutes: 4,
            upload_consent: false,
        }
    }
}
impl LiveSummaryPreferences {
    /// Local Qwen live summaries were removed in 0.3.10. Turn a stored legacy
    /// `"local"` (or any other unsupported) provider off in raw preference
    /// JSON before typed decoding. Returns whether anything changed; unrelated
    /// preferences stay intact and an unknown provider is never migrated into
    /// a cloud upload.
    pub fn disable_unsupported(preferences: &mut serde_json::Value) -> bool {
        let Some(summaries) = preferences
            .get_mut("liveSummaries")
            .and_then(|value| value.as_object_mut())
        else {
            return false;
        };
        match summaries.get("provider") {
            None => return false,
            Some(provider) if CloudChoice::deserialize(provider).is_ok() => return false,
            Some(_) => {}
        }
        summaries.insert("enabled".into(), false.into());
        summaries.insert("provider".into(), CloudChoice::None.as_str().into());
        summaries.insert("model".into(), Self::default().model.into());
        summaries.insert("uploadConsent".into(), false.into());
        true
    }
    pub fn validate(&self) -> crate::error::AppResult<()> {
        if !matches!(self.interval_minutes, 2 | 4 | 5)
            || self.model.is_empty()
            || self.model.len() > 120
            || !self
                .model
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-._/".contains(c))
        {
            return Err(
                "Choose a valid summary service, model and an interval of 2, 4 or 5 minutes."
                    .into(),
            );
        }
        if self.enabled && self.provider.cloud().is_some() && !self.upload_consent {
            return Err("Before enabling cloud summaries, allow the selected provider to receive the matching English transcript and course background.".into());
        }
        Ok(())
    }
}
