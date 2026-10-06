param([string]$RuntimePath, [string]$ExpectedRuntimePath)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'file-hash.ps1')
$staging = Join-Path $projectRoot 'apps/desktop/src-tauri/resources/local-asr'
if ($ExpectedRuntimePath) { $staging = [IO.Path]::GetFullPath($ExpectedRuntimePath) }
if (!$RuntimePath) { $RuntimePath=$staging }
$RuntimePath = [IO.Path]::GetFullPath($RuntimePath)
$runtime = Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/native/speech-worker/runtime.json') -Raw | ConvertFrom-Json
$expected=@($runtime.dlls)+@('asr-worker.exe')
$actual=@(Get-ChildItem -LiteralPath $RuntimePath -File | Select-Object -ExpandProperty Name)
if (Compare-Object $expected $actual) { throw 'Runtime file set differs from the audited ASR-only list' }
$sdkLicenses = Join-Path $projectRoot 'target/native/speech-worker/nemo/share/licenses/nemo-speech'
$expectedLicenses=@(Get-ChildItem -LiteralPath $sdkLicenses -Recurse -File | ForEach-Object { $_.FullName.Substring($sdkLicenses.Length+1) })+@('NVIDIA-Open-Model-License.pdf','NVIDIA-Model-NOTICE.txt')
$licenseRoot=Join-Path $RuntimePath 'licenses'
$actualLicenses=@(Get-ChildItem -LiteralPath $licenseRoot -Recurse -File | ForEach-Object { $_.FullName.Substring($licenseRoot.Length+1) })
if (Compare-Object $expectedLicenses $actualLicenses) { throw 'Runtime license set differs, or contains stale duplicate notices' }
foreach ($relative in @($expected)+@($expectedLicenses | ForEach-Object { Join-Path 'licenses' $_ })) {
  $source=Join-Path $staging $relative
  $copy=Join-Path $RuntimePath $relative
  if (!(Test-Path -LiteralPath $source)) { throw "Missing expected runtime resource: $relative" }
  if (!(Test-Path -LiteralPath $copy)) { throw "Missing runtime resource: $relative" }
  if ((Get-SourceSha256 $source) -ne (Get-SourceSha256 $copy)) { throw "Runtime resource differs: $relative" }
}
foreach ($required in @('licenses/LICENSE','licenses/NOTICE','licenses/THIRD_PARTY_NOTICES.md','licenses/third_party/ggml/LICENSE','licenses/NVIDIA-Open-Model-License.pdf','licenses/NVIDIA-Model-NOTICE.txt')) {
  if (!(Test-Path -LiteralPath (Join-Path $RuntimePath $required))) { throw "Missing notice: $required" }
}
$config=Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
if ($config.bundle.resources.'resources/local-text/' -ne 'local-text/') { throw 'Local text runtime resource mapping missing' }
$textRuntime=Join-Path (Split-Path $RuntimePath -Parent) 'local-text'
$textManifest=Get-Content -LiteralPath (Join-Path $textRuntime 'runtime-manifest.json') -Raw | ConvertFrom-Json
$textStaging=Join-Path (Split-Path $staging -Parent) 'local-text'
$expectedText=@($textManifest.files.PSObject.Properties.Name)+@('runtime-manifest.json')
$actualText=@(Get-ChildItem -LiteralPath $textRuntime -File | Select-Object -ExpandProperty Name)
if (Compare-Object $expectedText $actualText) { throw 'Text runtime file set differs from its manifest' }
if ((Get-SourceSha256 (Join-Path $textRuntime 'runtime-manifest.json')) -ne (Get-SourceSha256 (Join-Path $textStaging 'runtime-manifest.json'))) { throw 'Installed text runtime manifest differs' }
foreach ($entry in $textManifest.files.PSObject.Properties) {
  $path=Join-Path $textRuntime $entry.Name
  if ((Get-SourceSha256 $path) -ne $entry.Value) { throw "Text runtime checksum differs: $($entry.Name)" }
  if ((Get-SourceSha256 $path) -ne (Get-SourceSha256 (Join-Path $textStaging $entry.Name))) { throw "Installed text runtime differs: $($entry.Name)" }
}
foreach ($name in @('llama-server.exe','llama-server-impl.dll','llama.dll','ggml.dll','ggml-base.dll','LICENSE-llama.cpp','LICENSE-LLVM-OpenMP','LICENSE-Hy-MT2.txt','LICENSE-Qwen3.5.txt')) {
  if (!(Test-Path -LiteralPath (Join-Path $textRuntime $name))) { throw "Missing text runtime resource: $name" }
}
Write-Output "Local text runtime verified: $($textManifest.runtime), $(@($textManifest.files.PSObject.Properties).Count) checked files."
if ($config.bundle.resources.'resources/local-asr/' -ne 'local-asr/') { throw 'Tauri resource mapping changed' }
foreach ($icon in @($config.bundle.icon)+@($config.bundle.windows.nsis.installerIcon,$config.bundle.windows.nsis.uninstallerIcon)) {
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot "apps/desktop/src-tauri/$icon"))) { throw "Missing icon: $icon" }
}
Write-Output "Runtime verified: worker, $($runtime.dlls.Count) DLLs, complete notices and configured phoenix icons."
