use crate::error::{AppResult, UserFacing};

pub fn provider_http_error(status: u16) -> String {
    match status {
        401 | 403 => "Authorization rejected. Check your API key and account permissions.",
        404 => "Model or endpoint unavailable. Check the model name.",
        413 => "Audio chunk exceeds the provider limit.",
        429 => "Provider quota or rate limit reached. Try again later.",
        500..=599 => "Provider unavailable. Try again later.",
        _ => "The provider could not process this request. Check the model, account and input.",
    }
    .into()
}

pub(super) async fn read_response(mut response: reqwest::Response) -> AppResult<serde_json::Value> {
    if !response.status().is_success() {
        return Err(provider_http_error(response.status().as_u16()));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .user_error("Provider response interrupted. Try again.")?
    {
        if bytes.len() + chunk.len() > 2 * 1024 * 1024 {
            return Err("Provider response exceeds the size limit.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).user_error("Provider response could not be parsed.")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
    };

    #[test]
    fn real_http_failure_responses_do_not_echo_authorization_or_response_content() {
        rustls::crypto::ring::default_provider()
            .install_default()
            .ok();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for status in [401, 403, 429, 503, 200] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                let count = socket.read(&mut request).unwrap();
                assert!(String::from_utf8_lossy(&request[..count]).contains("test-canary"));
                let body = "Provider error echoes test-canary and private-lecture-canary";
                write!(socket, "HTTP/1.1 {status} Fixture\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
            });
            let error = runtime.block_on(async {
                let response = reqwest::Client::new()
                    .get(format!("http://{address}"))
                    .header("authorization", "Bearer test-canary")
                    .send()
                    .await
                    .unwrap();
                read_response(response).await.unwrap_err()
            });
            server.join().unwrap();
            assert!(!error.contains("canary"));
            assert!(!error.contains("Bearer"));
            assert!(!error.contains(&address.to_string()));
            if status == 429 {
                assert!(error.contains("rate limit"));
            }
            if status == 200 {
                assert!(error.contains("parsed"));
            }
        }
    }
}
