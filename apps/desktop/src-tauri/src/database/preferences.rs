use super::Storage;
use crate::{
    domain::*,
    error::{AppResult, UserFacing},
};
use rusqlite::{OptionalExtension, params};

impl Storage {
    pub fn install_model(&self, id: &str, revision: &str, hash: &str, size: u64) -> AppResult<()> {
        let runtime = crate::models::catalog::get(id)?.runtime;
        self.lock()?.execute("INSERT OR REPLACE INTO local_models(id,revision,runtime_version,sha256,size_bytes,installed_at) VALUES(?1,?2,?6,?3,?4,?5)",params![id,revision,hash,size as i64,now(),runtime]).user_error("Cannot save model metadata.")?;
        Ok(())
    }
    pub fn remove_model(&self, id: &str) -> AppResult<()> {
        self.lock()?
            .execute("DELETE FROM local_models WHERE id=?1", [id])
            .user_error("Cannot remove model metadata.")?;
        Ok(())
    }
    pub fn settings(&self) -> AppResult<AppSettings> {
        let text: Option<String> = self
            .lock()?
            .query_row(
                "SELECT value FROM app_settings WHERE key='preferences'",
                [],
                |r| r.get(0),
            )
            .optional()
            .user_error("Cannot read settings.")?;
        match text {
            Some(text) => decode_settings(&text),
            None => Ok(AppSettings::default()),
        }
    }

    pub fn save_settings(&self, settings: AppSettings) -> AppResult<()> {
        settings.live_summaries.validate()?;
        if !matches!(
            settings.translation_model.as_str(),
            "hy-mt2-1.8b" | "qwen3.5-4b"
        ) {
            return Err("Choose a supported local translation model.".into());
        }
        if !matches!(settings.theme.as_str(), "light" | "dark") {
            return Err("Choose Light or Dark appearance.".into());
        }
        if !matches!(
            settings.translation_mode.as_str(),
            "local" | "cloud" | "none"
        ) || !matches!(settings.study_mode.as_str(), "local" | "cloud" | "none")
        {
            return Err("Choose local, cloud or off for translation and study tools.".into());
        }
        if !matches!(
            settings.speech_provider.as_str(),
            "none" | "local" | "openai" | "groq"
        ) || !matches!(settings.audio_source.as_str(), "microphone" | "system")
            || !(16..=44).contains(&settings.english_font_size)
            || !(14..=36).contains(&settings.translation_font_size)
            || (!settings.show_english && !settings.show_translation)
            || settings.microphone_device_id.len() > 2048
            || settings.system_device_id.len() > 2048
            || !valid_language(&settings.assistance_language)
            || !matches!(settings.provider.as_str(), "none" | "openai" | "groq")
            || settings.chat_model.trim().is_empty()
            || settings.chat_model.len() > 120
            || !settings
                .chat_model
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "-._/".contains(c))
        {
            return Err("Check your language, provider and caption preferences. Keep at least one caption language visible.".into());
        }
        let value = serde_json::to_string(&settings).user_error("Cannot encode settings.")?;
        self.lock()?.execute("INSERT INTO app_settings(key,value) VALUES('preferences',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [value]).user_error("Cannot save settings.")?;
        Ok(())
    }
}

fn decode_settings(text: &str) -> AppResult<AppSettings> {
    let value: serde_json::Value =
        serde_json::from_str(text).user_error("Saved settings could not be read.")?;
    let mut settings: AppSettings =
        serde_json::from_value(value.clone()).user_error("Saved settings could not be read.")?;
    // Retain a previous explicit cloud selection when upgrading existing preferences.
    if settings.provider != "none" {
        if value.get("translationMode").is_none() {
            settings.translation_mode = "cloud".into();
        }
        if value.get("studyMode").is_none() {
            settings.study_mode = "cloud".into();
        }
    }
    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn upgrade_preserves_explicit_cloud_and_keeps_new_installs_local() {
        assert_eq!(
            decode_settings(r#"{"provider":"openai"}"#)
                .unwrap()
                .translation_mode,
            "cloud"
        );
        assert_eq!(
            decode_settings(r#"{"provider":"none"}"#)
                .unwrap()
                .study_mode,
            "local"
        );
        assert_eq!(
            decode_settings(
                r#"{"provider":"openai","translationMode":"local","studyMode":"none"}"#
            )
            .unwrap()
            .translation_mode,
            "local"
        );
    }
}
