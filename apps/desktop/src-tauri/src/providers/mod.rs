pub(crate) mod contracts;
mod http;
pub(crate) mod local;
mod official;
pub(crate) use local::{Role, configured_text};

pub(crate) use contracts::*;
pub(crate) use official::{OfficialProvider, configured};

#[cfg(test)]
mod tests {
    #[test]
    fn provider_errors_never_include_payloads_or_credentials() {
        for status in [400, 401, 403, 404, 413, 429, 500] {
            let message = super::http::provider_http_error(status);
            assert!(!message.contains("Bearer"));
            assert!(!message.contains("https://"));
        }
    }
    #[test]
    fn handles_fenced_translation_json_and_rejects_prose() {
        let values = super::official::parse_translations(
            "```json\n[{\"id\":\"one\",\"text\":\"遗传学\"}]\n```",
        )
        .unwrap();
        assert_eq!(values[0].text, "遗传学");
        assert!(super::official::parse_translations("invalid response").is_err());
    }
}
