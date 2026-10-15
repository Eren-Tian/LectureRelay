use crate::error::{AppResult, UserFacing};
use std::io::Cursor;

pub fn encode_chunk(samples: &[i16], spec: hound::WavSpec) -> AppResult<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(&mut cursor, spec)
            .user_error(crate::error::ErrorCode::CannotEncodeAudioChunk)?;
        for sample in samples {
            writer
                .write_sample(*sample)
                .user_error(crate::error::ErrorCode::CannotEncodeAudioChunk)?;
        }
        writer
            .finalize()
            .user_error(crate::error::ErrorCode::CannotEncodeAudioChunk)?;
    }
    Ok(cursor.into_inner())
}
