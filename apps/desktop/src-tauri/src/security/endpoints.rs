use crate::error::AppResult;

pub(crate) fn provider_base(provider: &str) -> AppResult<&'static str> {
    Ok(match provider {
        "openai" => "https://api.openai.com/v1",
        "groq" => "https://api.groq.com/openai/v1",
        _ => return Err("Choose an AI provider and add a key in Settings.".into()),
    })
}
