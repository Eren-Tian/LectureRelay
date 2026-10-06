use crate::error::{AppResult, UserFacing};

pub(crate) struct SummaryFailure {
    pub message: String,
    pub retry_after: u64,
}
impl From<String> for SummaryFailure {
    fn from(message: String) -> Self {
        Self {
            message,
            retry_after: 0,
        }
    }
}
pub(super) async fn read_summary_response(
    response: reqwest::Response,
) -> Result<serde_json::Value, SummaryFailure> {
    let status = response.status().as_u16();
    if response.status().is_success() {
        return read_response(response).await.map_err(Into::into);
    }
    // Never expose a provider error body, URL, headers, prompt, or credential.
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(60)
        .max(1);
    let message = match status {
        401 => "API Key 无效或已撤销，请替换后重新测试。",
        402 => "账户余额或 API 计费未就绪，请检查服务商账户；录音继续保存。",
        403 => "账户没有访问权限，请检查服务地区、模型权限和账户状态。",
        404 => "所选模型不可用，请在高级设置中更换模型后测试。",
        429 => "免费额度已耗尽或请求受限，请检查账户额度并稍后重试；录音继续保存。",
        400 | 422 => "模型不支持本次总结参数，请使用推荐模型，或核对高级模型设置。",
        500..=599 => "服务商暂时不可用，原文已保存，请稍后重试。",
        _ => "总结请求未完成，请检查账户和模型设置。原文已保存。",
    };
    Err(SummaryFailure {
        message: message.into(),
        retry_after: if status == 429 { retry_after } else { 0 },
    })
}

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

    #[test]
    fn summary_http_failures_are_actionable_and_honor_retry_after_without_echoing_body() {
        rustls::crypto::ring::default_provider()
            .install_default()
            .ok();
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for status in [401, 402, 403, 404, 422, 429, 503, 200] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                let mut request = [0; 4096];
                assert!(socket.read(&mut request).unwrap() > 0);
                let body = "secret-canary private-transcript-canary";
                write!(socket,"HTTP/1.1 {status} Fixture\r\nRetry-After: 123\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).unwrap();
            });
            let error = runtime.block_on(async {
                let response = reqwest::Client::new()
                    .get(format!("http://{address}"))
                    .send()
                    .await
                    .unwrap();
                match read_summary_response(response).await {
                    Err(e) => e,
                    Ok(_) => panic!("Fixture must fail"),
                }
            });
            server.join().unwrap();
            assert!(!error.message.contains("canary"));
            assert!(!error.message.contains(&address.to_string()));
            assert_eq!(error.retry_after, if status == 429 { 123 } else { 0 });
            if status == 401 {
                assert!(error.message.contains("Key"));
            }
            if status == 404 {
                assert!(error.message.contains("模型"));
            }
        }
    }
}
