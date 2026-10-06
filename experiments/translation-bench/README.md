# Offline translation prototype

Research comparison only; this executable and Mozilla weights are not part of
the LectureRelay installer. End users do not need to install this tool.

The pinned dependency is `fxtranslate` 0.5.0 (MPL-2.0), source inspected at
[f2f77cd](https://github.com/gregtatum/translations/tree/f2f77cd302bf616367aaf836c034af23dff6266f/inference-rs).
Its implementation uses Marian-compatible quantized encoder/SSRU decoder
weights, an optional Gemmology SIMD path, persistent immutable weights and
sentence segmentation. On the tested MSVC toolchain its C++ shim fails to build
and it falls back to the portable scalar kernel. The recorded timings are for
that fallback, not a verified SIMD build. `FXTRANSLATE_REQUIRE_SIMD=1` makes this
limitation explicit as a build failure rather than a silent fallback.
Our program is an original JSON-lines controller around its public API. There
is no network feature in this executable. The dependency's MPL source and
vendored third-party notices remain available from its pinned crate/source.

Developer build:

```powershell
node scripts/dev/run-native.mjs cargo build --manifest-path experiments/translation-bench/Cargo.toml --release --locked
```

Acquire model files independently from the
[Mozilla model registry](https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data/db/models.json),
save provenance and verify its uncompressed hash before testing. The benchmark
requires local model, source vocabulary, target vocabulary and shortlist paths.
No proprietary CourseDude bundle is used. Preserve Mozilla's model license if
these assets are ever redistributed. Do not rely on Firefox's production CDN
as a downstream application's model hosting contract.
