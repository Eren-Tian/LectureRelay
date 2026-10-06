#pragma once
#include <cstdint>

// Endpoint timing must be independent of the parent's IPC batch size.
// This retains the existing amplitude threshold; it does not discard audio.
struct TrailingSilence {
    static constexpr uint32_t required = 8000; // 500 ms at 16 kHz
    uint32_t samples = 0;
    void observe(const float* pcm, uint32_t count) {
        for (uint32_t i = 0; i < count; ++i) {
            if (pcm[i] > .004f || pcm[i] < -.004f) samples = 0;
            else if (samples < required) ++samples;
        }
    }
    bool qualifies() const { return samples >= required; }
};
