use crate::{
    domain::ProviderStatus,
    error::{AppResult, UserFacing},
};
use windows::{
    Win32::{Foundation::ERROR_NOT_FOUND, Security::Credentials::*},
    core::{PCWSTR, PWSTR},
};
use zeroize::{Zeroize, Zeroizing};

fn target(provider: &str) -> AppResult<String> {
    if !matches!(provider, "openai" | "groq") {
        return Err("Unsupported provider.".into());
    }
    Ok(format!("LectureRelay/provider/{provider}"))
}

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

pub fn save(provider: &str, key: String) -> AppResult<()> {
    let key = Zeroizing::new(key);
    if key.trim() != key.as_str()
        || key.len() < 8
        || key.len() > 2000
        || !key.is_ascii()
        || key.chars().any(char::is_whitespace)
    {
        return Err("Paste a valid API key without spaces or newlines.".into());
    }
    save_target(&target(provider)?, key.as_str())
}

fn save_target(name: &str, key: &str) -> AppResult<()> {
    let mut target = wide(name);
    let mut user = wide("LectureRelay");
    let mut blob = Zeroizing::new(key.as_bytes().to_vec());
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(target.as_mut_ptr()),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        UserName: PWSTR(user.as_mut_ptr()),
        ..Default::default()
    };
    // Credential Manager copies the blob. The plaintext buffer is then zeroized.
    unsafe { CredWriteW(&credential, 0) }
        .user_error("Windows Credential Manager could not save the key.")
}

pub fn load(provider: &str) -> AppResult<Option<Zeroizing<String>>> {
    load_target(&target(provider)?)
}

fn load_target(name: &str) -> AppResult<Option<Zeroizing<String>>> {
    let name = wide(name);
    let mut pointer = std::ptr::null_mut();
    match unsafe { CredReadW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None, &mut pointer) } {
        Ok(()) => {
            // The OS allocation remains owned by CredFree; copy, zero, then free it.
            let credential = unsafe { &mut *pointer };
            if credential.CredentialBlob.is_null() || credential.CredentialBlobSize == 0 {
                unsafe { CredFree(pointer.cast()) };
                return Err("The saved key is empty. Add it again.".into());
            }
            let blob = unsafe {
                std::slice::from_raw_parts_mut(
                    credential.CredentialBlob,
                    credential.CredentialBlobSize as usize,
                )
            };
            let value = String::from_utf8(blob.to_vec())
                .user_error("The saved key cannot be read. Add it again.");
            blob.zeroize();
            unsafe { CredFree(pointer.cast()) };
            value.map(|value| Some(Zeroizing::new(value)))
        }
        Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => Ok(None),
        Err(_) => Err("Windows Credential Manager could not read the key.".into()),
    }
}

pub fn remove(provider: &str) -> AppResult<()> {
    remove_target(&target(provider)?)
}

fn remove_target(name: &str) -> AppResult<()> {
    let name = wide(name);
    match unsafe { CredDeleteW(PCWSTR(name.as_ptr()), CRED_TYPE_GENERIC, None) } {
        Ok(()) => Ok(()),
        Err(error) if error.code() == ERROR_NOT_FOUND.to_hresult() => Ok(()),
        Err(_) => Err("Windows Credential Manager could not remove the key.".into()),
    }
}

pub fn status(provider: &str) -> AppResult<ProviderStatus> {
    let key = load(provider)?;
    Ok(ProviderStatus {
        provider: provider.into(),
        has_key: key.is_some(),
        masked_key: key
            .as_ref()
            .map(|key| {
                format!(
                    "••••••••••••{}",
                    key.chars()
                        .rev()
                        .take(4)
                        .collect::<String>()
                        .chars()
                        .rev()
                        .collect::<String>()
                )
            })
            .unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "writes a synthetic credential to a dedicated test target"]
    fn windows_credential_roundtrip_replace_and_remove() {
        let target = format!("LectureRelay/tests/{}", uuid::Uuid::new_v4());
        super::save_target(&target, "synthetic-test-value-one").unwrap();
        assert_eq!(
            super::load_target(&target).unwrap().unwrap().as_str(),
            "synthetic-test-value-one"
        );
        super::save_target(&target, "synthetic-test-value-two").unwrap();
        assert_eq!(
            super::load_target(&target).unwrap().unwrap().as_str(),
            "synthetic-test-value-two"
        );
        super::remove_target(&target).unwrap();
        assert!(super::load_target(&target).unwrap().is_none());
    }
}
