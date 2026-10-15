pub use crate::error_codes::ErrorCode;
pub type AppResult<T> = Result<T, AppError>;

/// IPC exposes only a stable identity and explicitly safe parameters, never raw causes.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub params: Vec<String>,
    #[serde(skip)]
    message: String,
}
impl AppError {
    pub fn model_required(name: &'static str) -> Self {
        Self {
            code: ErrorCode::ModelRequired,
            params: vec![name.to_owned()],
            message: format!(
                "Download {} in Settings → AI & models → Local models first. No text has been uploaded.",
                name
            ),
        }
    }
    pub fn as_str(&self) -> &str {
        &self.message
    }
}
impl From<ErrorCode> for AppError {
    fn from(code: ErrorCode) -> Self {
        Self {
            code,
            params: Vec::new(),
            message: code.message().into(),
        }
    }
}
impl From<&str> for AppError {
    fn from(message: &str) -> Self {
        ErrorCode::from_legacy(message).into()
    }
}
impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::from(message.as_str())
    }
}
impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.message
    }
}
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}
impl std::ops::Deref for AppError {
    type Target = str;
    fn deref(&self) -> &str {
        &self.message
    }
}
impl std::error::Error for AppError {}

pub trait UserFacing<T> {
    fn user_error(self, code: ErrorCode) -> AppResult<T>;
}

impl<T, E> UserFacing<T> for Result<T, E> {
    fn user_error(self, code: ErrorCode) -> AppResult<T> {
        self.map_err(|_| code.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn ipc_errors_have_stable_identities_without_raw_causes() {
        let error: AppError = ErrorCode::CannotSaveNotes.into();
        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            serde_json::json!({
                "code": "cannot_save_notes", "params": []
            })
        );
        let cause = AppError::from("untrusted-provider-and-credential-canary");
        assert_eq!(cause.code, ErrorCode::OperationFailed);
        assert!(!cause.to_string().contains("canary"));
        assert!(!serde_json::to_string(&cause).unwrap().contains("canary"));
        let model = AppError::model_required("Hy-MT2-1.8B");
        assert_eq!(
            serde_json::to_value(model).unwrap(),
            serde_json::json!({
                "code": "model_required", "params": ["Hy-MT2-1.8B"]
            })
        );
    }
}
