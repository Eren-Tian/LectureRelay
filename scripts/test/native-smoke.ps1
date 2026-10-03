param([switch]$Audio, [switch]$DownloadModel)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location $projectRoot
try {
  & pnpm.cmd build:asr
  if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed' }
  & node.exe scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --lib native_stream_resamples_finalizes_and_reports_worker_crash -- --ignored
  if ($LASTEXITCODE -ne 0) { throw 'Native STT test failed' }
  & node.exe scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --lib windows_credential_roundtrip_replace_and_remove -- --ignored
  if ($LASTEXITCODE -ne 0) { throw 'Credential test failed' }
  if ($Audio) {
    & node.exe scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --test native_audio -- --ignored
    if ($LASTEXITCODE -ne 0) { throw 'Hardware audio test failed' }
  }
  if ($DownloadModel) {
    & node.exe scripts/dev/run-native.mjs cargo test -p lecturerelay-desktop --lib official_model_download_cancel_install_and_remove -- --ignored
    if ($LASTEXITCODE -ne 0) { throw 'Model manager test failed' }
  }
} finally { Pop-Location }
