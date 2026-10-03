param([string]$RuntimePath)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'file-hash.ps1')
$staging = Join-Path $projectRoot 'apps/desktop/src-tauri/resources/local-asr'
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
foreach ($file in Get-ChildItem -LiteralPath $staging -Recurse -File) {
  $relative=$file.FullName.Substring($staging.Length+1)
  $copy=Join-Path $RuntimePath $relative
  if (!(Test-Path -LiteralPath $copy)) { throw "Missing runtime resource: $relative" }
  if ((Get-SourceSha256 $file.FullName) -ne (Get-SourceSha256 $copy)) { throw "Runtime resource differs: $relative" }
}
foreach ($required in @('licenses/LICENSE','licenses/NOTICE','licenses/THIRD_PARTY_NOTICES.md','licenses/third_party/ggml/LICENSE','licenses/NVIDIA-Open-Model-License.pdf','licenses/NVIDIA-Model-NOTICE.txt')) {
  if (!(Test-Path -LiteralPath (Join-Path $RuntimePath $required))) { throw "Missing notice: $required" }
}
$config=Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
if ($config.bundle.resources.'resources/local-asr/' -ne 'local-asr/') { throw 'Tauri resource mapping changed' }
foreach ($icon in @($config.bundle.icon)+@($config.bundle.windows.nsis.installerIcon,$config.bundle.windows.nsis.uninstallerIcon)) {
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot "apps/desktop/src-tauri/$icon"))) { throw "Missing icon: $icon" }
}
Write-Output "Runtime verified: worker, $($runtime.dlls.Count) DLLs, complete notices and configured phoenix icons."
