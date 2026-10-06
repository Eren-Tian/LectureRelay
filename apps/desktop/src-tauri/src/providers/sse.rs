//! Bounded incremental decoding for the pinned local runtime, never a cloud stream.
use crate::error::{AppResult, UserFacing};

#[derive(Default)]
pub(super) struct CompletionStream {
    pending: Vec<u8>,
    pub text: String,
    pub done: bool,
    finish: Option<String>,
    received: usize,
}
impl CompletionStream {
    pub fn feed(&mut self, bytes: &[u8]) -> AppResult<bool> {
        // SSE repeats a JSON envelope per token; its wire limit must allow that
        // overhead while the decoded-text limit remains the non-stream limit.
        self.received = self.received.saturating_add(bytes.len());
        if self.received > 2_000_000 {
            return Err("Local AI response exceeds the limit.".into());
        }
        self.pending.extend_from_slice(bytes);
        let before = self.text.len();
        while let Some(end) = self.pending.iter().position(|b| *b == b'\n') {
            let line: Vec<_> = self.pending.drain(..=end).collect();
            self.line(&line)?;
        }
        Ok(self.text.len() != before)
    }
    fn line(&mut self, bytes: &[u8]) -> AppResult<()> {
        let line = std::str::from_utf8(bytes)
            .user_error("Local AI returned invalid data.")?
            .trim();
        let Some(data) = line.strip_prefix("data:").map(str::trim) else {
            return Ok(());
        };
        if data == "[DONE]" {
            self.done = true;
            return Ok(());
        }
        if self.done {
            return Err("Local AI returned invalid data.".into());
        }
        let value: serde_json::Value =
            serde_json::from_str(data).user_error("Local AI returned invalid data.")?;
        if value.get("error").is_some() {
            return Err("Local AI request failed. Saved audio and text are preserved; retry or choose a smaller task.".into());
        }
        if let Some(text) = value["choices"][0]["delta"]["content"].as_str() {
            if self.finish.is_some() {
                return Err("Local AI returned invalid data.".into());
            }
            self.text.push_str(text);
            if self.text.len() > 256_000 {
                return Err("Local AI response exceeds the limit.".into());
            }
        }
        if let Some(reason) = value["choices"][0]["finish_reason"].as_str() {
            self.finish = Some(reason.into());
        }
        Ok(())
    }
    pub fn finish(mut self) -> AppResult<String> {
        if !self.pending.is_empty() {
            let line = std::mem::take(&mut self.pending);
            self.line(&line)?;
        }
        if self.finish.as_deref() == Some("length") {
            return Err(super::local::OUTPUT_LIMIT.into());
        }
        if !self.done || self.finish.as_deref() != Some("stop") {
            return Err(
                "Local AI did not complete its response. Saved results are preserved.".into(),
            );
        }
        let text = self.text.trim();
        if text.is_empty() {
            return Err("Local AI returned no text. Try again.".into());
        }
        Ok(text.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn local_stream_handles_fragmented_utf8_and_requires_completed_output() {
        let data = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"线粒体\"},\"finish_reason\":null}]}\r\n\r\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"产生 ATP。\"},\"finish_reason\":null}]}\n\n",
            "data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}]}\n\n",
            "data: [DONE]\n\n"
        );
        for size in [1, 7, 43, data.len()] {
            let mut stream = CompletionStream::default();
            for bytes in data.as_bytes().chunks(size) {
                stream.feed(bytes).unwrap();
            }
            assert_eq!(stream.finish().unwrap(), "线粒体产生 ATP。");
        }
        let mut truncated = CompletionStream::default();
        truncated
            .feed(b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n")
            .unwrap();
        assert_eq!(truncated.text, "partial");
        assert!(truncated.finish().is_err());
    }

    #[test]
    fn local_stream_rejects_length_limits_errors_and_unbounded_data() {
        let mut stream = CompletionStream::default();
        stream.feed(b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"},\"finish_reason\":\"length\"}]}\ndata: [DONE]\n").unwrap();
        assert_eq!(
            stream.finish().unwrap_err(),
            super::super::local::OUTPUT_LIMIT
        );
        assert!(
            CompletionStream::default()
                .feed(&vec![b'x'; 2_000_001])
                .is_err()
        );
        assert!(
            CompletionStream::default()
                .feed(b"data: {\"error\":\"secret fixture\"}\n")
                .unwrap_err()
                .find("secret")
                .is_none()
        );
    }
}
