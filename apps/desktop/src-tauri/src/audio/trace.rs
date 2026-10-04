//! Bounded capture evidence. The real-time callback never waits for this lock or writes files.
use crate::storage::write_atomic;
use std::{
    collections::VecDeque,
    path::Path,
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const MAX_EVENTS: usize = 8192;

#[derive(Clone, Copy, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct PacketTiming {
    pub received_frame_start: u64,
    pub frames: u64,
    pub capture_offset_us: i64,
    pub callback_delay_us: Option<u64>,
    pub callback_minus_capture_us: i64,
    pub delta_from_expected_us: Option<i64>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct Event {
    kind: &'static str,
    monotonic_us: u64,
    received_frames: u64,
    queued_samples: u64,
    written_samples: u64,
    paused: bool,
    samples: Option<u64>,
    // CPAL does not expose WASAPI device position/flag validity. Never infer loss from Xrun.
    missing_samples: Option<u64>,
    packet: Option<PacketTiming>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration_us: Option<u64>,
}

pub(super) struct CaptureTrace {
    started: Instant,
    started_unix_ms: u64,
    events: Mutex<VecDeque<Event>>,
    pub received: AtomicU64,
    pub queued: AtomicU64,
    pub written: AtomicU64,
    pub paused_discarded: AtomicU64,
    pub invalid_replaced: AtomicU64,
    pub queue_discarded: AtomicU64,
    pub receiver_discarded: AtomicU64,
    omitted_events: AtomicU64,
    persistence_failures: AtomicU64,
}

impl Default for CaptureTrace {
    fn default() -> Self {
        Self {
            started: Instant::now(),
            started_unix_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
            events: Mutex::new(VecDeque::with_capacity(MAX_EVENTS)),
            received: AtomicU64::new(0),
            queued: AtomicU64::new(0),
            written: AtomicU64::new(0),
            paused_discarded: AtomicU64::new(0),
            invalid_replaced: AtomicU64::new(0),
            queue_discarded: AtomicU64::new(0),
            receiver_discarded: AtomicU64::new(0),
            omitted_events: AtomicU64::new(0),
            persistence_failures: AtomicU64::new(0),
        }
    }
}

impl CaptureTrace {
    pub fn elapsed_us(&self) -> u64 {
        self.started.elapsed().as_micros() as u64
    }

    pub fn event(
        &self,
        kind: &'static str,
        paused: bool,
        samples: Option<u64>,
        packet: Option<PacketTiming>,
    ) {
        self.record_event(kind, paused, samples, packet, None);
    }

    pub fn measure<T>(&self, kind: &'static str, paused: bool, operation: impl FnOnce() -> T) -> T {
        let started = Instant::now();
        let result = operation();
        let elapsed = started.elapsed();
        if elapsed >= Duration::from_millis(50) {
            self.record_event(kind, paused, None, None, Some(elapsed.as_micros() as u64));
        }
        result
    }

    fn record_event(
        &self,
        kind: &'static str,
        paused: bool,
        samples: Option<u64>,
        packet: Option<PacketTiming>,
        duration_us: Option<u64>,
    ) {
        let event = Event {
            kind,
            monotonic_us: self.elapsed_us(),
            received_frames: self.received.load(Ordering::Relaxed),
            queued_samples: self.queued.load(Ordering::Relaxed),
            written_samples: self.written.load(Ordering::Relaxed),
            paused,
            samples,
            missing_samples: None,
            packet,
            duration_us,
        };
        if let Ok(mut events) = self.events.try_lock() {
            if events.len() == MAX_EVENTS {
                events.pop_front();
                self.omitted_events.fetch_add(1, Ordering::Relaxed);
            }
            events.push_back(event);
        } else {
            // Contention discards diagnostics only, never blocks or discards captured audio.
            self.omitted_events.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn save(&self, recording: &Path, rate: u32, channels: usize, complete: bool) {
        let Some(directory) = recording.parent() else {
            return;
        };
        let Ok(events) = self
            .events
            .lock()
            .map(|events| events.iter().cloned().collect::<Vec<_>>())
        else {
            return;
        };
        let queued = self.queued.load(Ordering::Relaxed);
        let written = self.written.load(Ordering::Relaxed);
        let value = serde_json::json!({
            "schema": 1, "complete": complete, "startedUnixMs": self.started_unix_ms,
            "elapsedUs": self.elapsed_us(), "timebase": "Rust Instant since capture setup; wall clock is correlation metadata only",
            "sampleRate": rate, "inputChannels": channels, "outputChannels": 1,
            "positionUnits": "receivedFrames: input frames; queued/written/discarded samples: mono output samples",
            "queueBudgetSeconds": 5, "queuePacketLimit": 8192,
            "cpalVersion": "0.18.2", "deviceFramePositionAvailable": false, "timestampFlagValidityAvailable": false,
            "receivedFrames": self.received.load(Ordering::Relaxed), "queuedSamples": queued, "writtenSamples": written,
            "discardedWhilePausedSamples": self.paused_discarded.load(Ordering::Relaxed),
            "acceptedButUnwrittenSamples": if complete { Some(queued.saturating_sub(written)) } else { None },
            "discardedQueueFullSamples": self.queue_discarded.load(Ordering::Relaxed),
            "discardedReceiverClosedSamples": self.receiver_discarded.load(Ordering::Relaxed),
            "silenceInsertedSamples": 0, "nonFiniteMonoSamplesReplacedWithZero": self.invalid_replaced.load(Ordering::Relaxed),
            "omittedEvents": self.omitted_events.load(Ordering::Relaxed), "eventLimit": MAX_EVENTS,
            "persistenceFailures": self.persistence_failures.load(Ordering::Relaxed), "events": events,
        });
        let result = serde_json::to_vec(&value)
            .map_err(|_| ())
            .and_then(|bytes| {
                write_atomic(&directory.join("recording-events.json"), &bytes).map_err(|_| ())
            });
        if result.is_err() {
            self.persistence_failures.fetch_add(1, Ordering::Relaxed);
        }
    }
}

pub(super) fn signed_delta_us(now: cpal::StreamInstant, previous: cpal::StreamInstant) -> i64 {
    if let Some(duration) = now.checked_duration_since(previous) {
        duration.as_micros().min(i64::MAX as u128) as i64
    } else {
        -(previous
            .checked_duration_since(now)
            .unwrap_or_default()
            .as_micros()
            .min(i64::MAX as u128) as i64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_trace_is_bounded_nonblocking_and_does_not_invent_loss() {
        let trace = CaptureTrace::default();
        for _ in 0..MAX_EVENTS + 9 {
            trace.event("device_discontinuity", false, None, None);
        }
        assert_eq!(trace.events.lock().unwrap().len(), MAX_EVENTS);
        assert_eq!(trace.omitted_events.load(Ordering::Relaxed), 9);
        let held = trace.events.lock().unwrap();
        trace.event("device_discontinuity", false, None, None);
        assert_eq!(trace.omitted_events.load(Ordering::Relaxed), 10);
        assert!(held.iter().all(|e| e.missing_samples.is_none()));
        assert_eq!(trace.queued.load(Ordering::Relaxed), 0);
    }
}
