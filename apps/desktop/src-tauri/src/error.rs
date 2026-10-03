pub type AppResult<T> = Result<T, String>;

pub trait UserFacing<T> {
    fn user_error(self, message: &str) -> AppResult<T>;
}

impl<T, E> UserFacing<T> for Result<T, E> {
    fn user_error(self, message: &str) -> AppResult<T> {
        self.map_err(|_| message.to_owned())
    }
}
