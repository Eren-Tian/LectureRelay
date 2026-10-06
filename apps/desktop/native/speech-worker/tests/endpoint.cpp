#include "../src/silence.hpp"
#include <cassert>
#include <vector>

int main() {
    std::vector<float> silence(5120, 0.0f);
    TrailingSilence state;
    state.observe(silence.data(), 5120);
    assert(!state.qualifies()); // One 320 ms IPC batch cannot end a sentence.
    state.observe(silence.data(), 2879);
    assert(!state.qualifies());
    state.observe(silence.data(), 1);
    assert(state.qualifies());
    float speech = -.005f;
    state.observe(&speech, 1);
    assert(!state.qualifies() && state.samples == 0);
    // The same waveform must yield the same state at the same audio position,
    // whether IPC batches are 160/320/640 ms or irregularly sized.
    std::vector<float> waveform(16000, 0.0f);
    waveform[9300] = .01f;
    TrailingSilence whole;
    whole.observe(waveform.data(), static_cast<uint32_t>(waveform.size()));
    for (uint32_t batch : {1u, 2560u, 5120u, 10240u}) {
        TrailingSilence split;
        for (uint32_t offset = 0; offset < waveform.size(); offset += batch) {
            auto count = static_cast<uint32_t>(waveform.size()) - offset;
            split.observe(waveform.data() + offset, count < batch ? count : batch);
        }
        assert(split.samples == whole.samples && split.qualifies() == whole.qualifies());
    }
    assert(!whole.qualifies());
}
