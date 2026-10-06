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
        // Enumerated choices are already validated by their typed decoding.
        settings.live_summaries.validate()?;
        if !matches!(
            settings.translation_model.as_str(),
            crate::models::catalog::TRANSLATION | crate::models::catalog::STUDY
        ) {
            return Err("Choose a supported local translation model.".into());
        }
        if !(16..=44).contains(&settings.english_font_size)
            || !(14..=36).contains(&settings.translation_font_size)
            || (!settings.show_english && !settings.show_translation)
            || settings.microphone_device_id.len() > 2048
            || settings.system_device_id.len() > 2048
            || !valid_language(&settings.assistance_language)
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
    let mut value: serde_json::Value =
        serde_json::from_str(text).user_error("Saved settings could not be read.")?;
    // Also protect settings reads from an old client writing legacy preferences.
    LiveSummaryPreferences::disable_unsupported(&mut value);
    // Only preferences saved before processing modes existed lack these
    // fields. Check before dropping unknown values, so an unreadable mode falls
    // back to Local instead of being mistaken for a missing one.
    let predates_translation_mode = value.get("translationMode").is_none();
    let predates_study_mode = value.get("studyMode").is_none();
    // A stored choice this version does not know falls back to its default
    // instead of making every settings read, including startup, fail.
    drop_unknown::<Theme>(&mut value, "theme");
    drop_unknown::<CloudChoice>(&mut value, "provider");
    drop_unknown::<ProcessingMode>(&mut value, "translationMode");
    drop_unknown::<ProcessingMode>(&mut value, "studyMode");
    drop_unknown::<SpeechEngine>(&mut value, "speechProvider");
    drop_unknown::<InputSource>(&mut value, "audioSource");
    let mut settings: AppSettings =
        serde_json::from_value(value).user_error("Saved settings could not be read.")?;
    // Retain a previous explicit cloud selection when upgrading existing preferences.
    if settings.provider.cloud().is_some() {
        if predates_translation_mode {
            settings.translation_mode = ProcessingMode::Cloud;
        }
        if predates_study_mode {
            settings.study_mode = ProcessingMode::Cloud;
        }
    }
    Ok(settings)
}

fn drop_unknown<T: serde::de::DeserializeOwned>(object: &mut serde_json::Value, key: &str) {
    if let Some(object) = object.as_object_mut()
        && object
            .get(key)
            .is_some_and(|value| T::deserialize(value).is_err())
    {
        object.remove(key);
    }
}

pub(super) fn disable_local_live_summaries(connection: &rusqlite::Connection) -> AppResult<()> {
    let text: Option<String> = connection
        .query_row(
            "SELECT value FROM app_settings WHERE key='preferences'",
            [],
            |row| row.get(0),
        )
        .optional()
        .user_error("Cannot read live summary settings.")?;
    let Some(text) = text else {
        return Ok(());
    };
    let mut value: serde_json::Value =
        serde_json::from_str(&text).user_error("Saved settings could not be read.")?;
    if !LiveSummaryPreferences::disable_unsupported(&mut value) {
        return Ok(());
    }
    let updated = serde_json::to_string(&value).user_error("Cannot save live summary settings.")?;
    connection
        .execute(
            "UPDATE app_settings SET value=?1 WHERE key='preferences' AND value=?2",
            params![updated, text],
        )
        .user_error("Cannot turn off the old local live summary setting.")?;
    Ok(())
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
            ProcessingMode::Cloud
        );
        assert_eq!(
            decode_settings(r#"{"provider":"none"}"#)
                .unwrap()
                .study_mode,
            ProcessingMode::Local
        );
        assert_eq!(
            decode_settings(
                r#"{"provider":"openai","translationMode":"local","studyMode":"none"}"#
            )
            .unwrap()
            .translation_mode,
            ProcessingMode::Local
        );
    }

    #[test]
    fn unreadable_processing_modes_with_a_cloud_provider_stay_local() {
        for provider in ["groq", "openai"] {
            for mode in [r#""remote""#, "null", "7"] {
                let settings = decode_settings(&format!(
                    r#"{{"provider":"{provider}","translationMode":{mode},"studyMode":{mode}}}"#
                ))
                .unwrap();
                assert_eq!(settings.translation_mode, ProcessingMode::Local, "{mode}");
                assert_eq!(settings.study_mode, ProcessingMode::Local, "{mode}");
            }
        }
        // Only a field that is really missing keeps the legacy cloud selection.
        let settings =
            decode_settings(r#"{"provider":"groq","translationMode":"remote"}"#).unwrap();
        assert_eq!(settings.translation_mode, ProcessingMode::Local);
        assert_eq!(settings.study_mode, ProcessingMode::Cloud);
    }

    #[test]
    fn unknown_stored_choices_fall_back_without_losing_known_preferences() {
        let settings = decode_settings(
            r#"{"theme":"sepia","speechProvider":"parakeet","audioSource":"system","translationMode":"remote","chatModel":"kept","liveSummaries":{"provider":"other","intervalMinutes":5}}"#,
        )
        .unwrap();
        assert_eq!(settings.theme, Theme::Light);
        assert_eq!(settings.speech_provider, SpeechEngine::None);
        assert_eq!(settings.audio_source, InputSource::System);
        assert_eq!(settings.translation_mode, ProcessingMode::Local);
        assert_eq!(settings.chat_model, "kept");
        // An unknown summary provider is turned off, never redirected to a cloud default.
        assert_eq!(settings.live_summaries.provider, CloudChoice::None);
        assert!(!settings.live_summaries.enabled);
        assert_eq!(settings.live_summaries.interval_minutes, 5);
        // Settings without newer sections still decode.
        assert!(decode_settings(r#"{"theme":"dark"}"#).is_ok());
        assert!(decode_settings("null").is_err());
        // Stored strings round-trip unchanged for the TypeScript contract.
        let encoded = serde_json::to_value(&settings).unwrap();
        assert_eq!(encoded["speechProvider"], "none");
        assert_eq!(encoded["audioSource"], "system");
    }
}
