use crate::domain::CloudProvider;

pub(crate) fn provider_base(provider: CloudProvider) -> &'static str {
    match provider {
        CloudProvider::OpenAi => "https://api.openai.com/v1",
        CloudProvider::Groq => "https://api.groq.com/openai/v1",
    }
}
