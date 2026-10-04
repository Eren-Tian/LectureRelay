use crate::{
    AppState,
    domain::*,
    error::{AppResult, UserFacing},
};
use std::{fs::File, path::Path};
use symphonia::core::{
    audio::SampleBuffer, codecs::DecoderOptions, errors::Error, formats::FormatOptions,
    io::MediaSourceStream, meta::MetadataOptions, probe::Hint,
};

pub(crate) fn read_pdf(path: &Path) -> AppResult<Vec<u8>> {
    use std::io::Read;
    const LIMIT: u64 = 50 * 1024 * 1024;
    let file = File::open(path).user_error("The local PDF is missing or unreadable.")?;
    if file.metadata().user_error("Cannot inspect PDF.")?.len() > LIMIT {
        return Err("Choose a valid PDF smaller than 50 MiB.".into());
    }
    // Bound the read as well: an external editor may grow the file after metadata().
    let mut bytes = Vec::new();
    file.take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .user_error("Cannot read PDF.")?;
    if bytes.len() as u64 > LIMIT || !bytes.starts_with(b"%PDF-") {
        return Err("Choose a valid PDF smaller than 50 MiB.".into());
    }
    Ok(bytes)
}

/// Decode packet-by-packet into our own mono PCM file. Source media is read-only.
pub fn decode(
    source: &Path,
    destination: &Path,
    mut checkpoint: impl FnMut(u32, u32) -> AppResult<()>,
) -> AppResult<f64> {
    let file = File::open(source).user_error("Cannot read the selected media file.")?;
    if file.metadata().user_error("Cannot inspect media.")?.len() > 2 * 1024 * 1024 * 1024 {
        return Err("Choose a media file smaller than 2 GiB.".into());
    }
    let mut hint = Hint::new();
    if let Some(ext) = source.extension().and_then(|s| s.to_str()) {
        hint.with_extension(ext);
    }
    let mut format = symphonia::default::get_probe()
        .format(
            &hint,
            MediaSourceStream::new(Box::new(file), Default::default()),
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .user_error("This media format is unsupported or damaged.")?
        .format;
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.sample_rate.is_some() && t.codec_params.channels.is_some())
        .ok_or("No supported audio track was found.")?;
    let id = track.id;
    let params = track.codec_params.clone();
    let rate = params.sample_rate.ok_or("Unknown audio sample rate.")?;
    if !(8000..=192000).contains(&rate) {
        return Err("Unsupported audio sample rate.".into());
    }
    let total = params.n_frames.unwrap_or(0).min(u32::MAX as u64) as u32;
    let mut decoder = symphonia::default::get_codecs()
        .make(&params, &DecoderOptions::default())
        .user_error("This audio codec is unsupported.")?;
    let mut writer = hound::WavWriter::create(
        destination,
        hound::WavSpec {
            channels: 1,
            sample_rate: rate,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .user_error("Cannot create imported audio. Check disk space.")?;
    let mut frames = 0u64;
    let mut last = 0;
    loop {
        checkpoint(frames.min(u32::MAX as u64) as u32, total)?;
        let packet = match format.next_packet() {
            Ok(p) => p,
            Err(Error::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(_) => {
                return Err("Media decoding failed. The original file was not changed.".into());
            }
        };
        if packet.track_id() != id {
            continue;
        }
        let decoded = decoder
            .decode(&packet)
            .user_error("Audio is damaged or uses an unsupported codec.")?;
        let spec = *decoded.spec();
        let channels = spec.channels.count();
        if spec.rate != rate || channels == 0 || channels > 8 {
            return Err("Changing audio format is unsupported.".into());
        }
        let mut samples = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        samples.copy_interleaved_ref(decoded);
        for frame in samples.samples().chunks_exact(channels) {
            let mono = frame.iter().sum::<f32>() / channels as f32;
            writer
                .write_sample((mono.clamp(-1.0, 1.0) * 32767.0) as i16)
                .user_error("Cannot write imported audio. Check disk space.")?;
            frames += 1;
        }
        if frames > rate as u64 * 5 * 60 * 60 {
            return Err("Media exceeds the five-hour import limit.".into());
        }
        if frames - last > rate as u64 * 10 {
            writer.flush().user_error("Cannot save imported audio.")?;
            last = frames;
        }
    }
    if frames == 0 {
        return Err("The selected file contains no decodable audio.".into());
    }
    // A declared duration that is substantially longer indicates truncated media.
    if total > 0 && frames + (rate as u64) < total as u64 {
        return Err("The audio track ended unexpectedly. Original media is preserved.".into());
    }
    writer
        .finalize()
        .user_error("Cannot finalize imported audio.")?;
    std::fs::OpenOptions::new()
        .write(true)
        .open(destination)
        .and_then(|f| f.sync_all())
        .user_error("Cannot save imported audio.")?;
    Ok(frames as f64 / rate as f64)
}

pub fn import(state: &AppState, course: &str, title: &str, source: &Path) -> AppResult<Lecture> {
    let (lecture, job) = {
        let _gate = state.gate.lock().user_error("The app is busy.")?;
        if state.recorder.status()?.is_some()
            || state.live.active()
            || state.jobs.status()?.is_some()
        {
            return Err("Finish active work before importing media.".into());
        }
        let lecture = state.storage.create_lecture(&state.paths, course, title)?;
        state.storage.set_audio_source(&lecture.id, "import")?;
        let job = state.jobs.begin(&lecture.id, "import")?;
        (lecture, job)
    };
    let target = state.paths.recording(course, &lecture.id)?;
    let pending = target.with_extension("importing");
    let mut last = 0;
    let mut audio_committed = false;
    let result = (|| {
        let duration = decode(source, &pending, |done, total| {
            state.jobs.checkpoint()?;
            if done.saturating_sub(last) > 16000 * 2 {
                state.jobs.progress(done, total);
                last = done;
            }
            Ok(())
        })?;
        state.jobs.checkpoint()?;
        std::fs::rename(&pending, &target).user_error("Cannot save imported audio.")?;
        audio_committed = true;
        state.storage.set_audio_source(&lecture.id, "import")?;
        state
            .storage
            .finish_lecture(&lecture.id, duration, "completed")?;
        state.storage.snapshot(&state.paths, &lecture.id)?;
        state.storage.lecture(&lecture.id)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&pending);
        if !audio_committed {
            let _ = state.storage.finish_lecture(&lecture.id, 0.0, "failed");
        }
    }
    job.finish(&result)?;
    result
}
