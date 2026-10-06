param([string]$InstallerPath, [string]$BuildMetadata)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'file-hash.ps1')
$expectedVersion=(Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json).version
if (!$InstallerPath) { $InstallerPath=Join-Path $projectRoot "target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_${expectedVersion}_x64-setup.exe" }
$metadata = if ($BuildMetadata) { Get-Content -LiteralPath $BuildMetadata -Raw | ConvertFrom-Json } else { $null }
if ($metadata) {
  if ($metadata.version -ne $expectedVersion -or !$metadata.coldBuild -or $metadata.sourceCommit -notmatch '^[0-9a-f]{40}$') { throw 'Invalid candidate build metadata' }
  if ((Get-SourceSha256 $InstallerPath) -ne $metadata.installer.sha256 -or (Get-Item -LiteralPath $InstallerPath).Length -ne $metadata.installer.bytes) { throw 'Installer differs from CI evidence' }
  if (!$metadata.payloadSha256.'lecturerelay-desktop.exe' -or !$metadata.payloadSha256.'local-asr/asr-worker.exe' -or !$metadata.payloadSha256.'local-text/runtime-manifest.json') { throw 'CI payload manifest is incomplete' }
}
# NSIS changes per-user registration and shortcuts even with /D. Keep them on
# the stable installation, never on a disposable verification directory.
$testRoot=Join-Path $env:LOCALAPPDATA 'Programs/LectureRelay'
if (Get-Process lecturerelay-desktop -ErrorAction SilentlyContinue) { throw 'Close LectureRelay before verifying its installer.' }
$data=Join-Path $env:LOCALAPPDATA 'LectureRelay/app.db'
$before=if (Test-Path -LiteralPath $data) { Get-SourceSha256 $data } else { $null }
# NSIS /D must be last and unquoted.
$installed=Start-Process -FilePath $InstallerPath -ArgumentList "/S /D=$testRoot" -WindowStyle Hidden -PassThru -Wait
if ($installed.ExitCode -ne 0) { throw "Installer failed: $($installed.ExitCode)" }
$exe=Join-Path $testRoot 'lecturerelay-desktop.exe'
$version=[Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
if ($version.ProductVersion -notmatch ('^'+[regex]::Escape($expectedVersion)+'(?:\.0)?$')) { throw 'Installed application version differs' }
$icon=Join-Path $projectRoot 'apps/desktop/src-tauri/icons/icon.ico'
$release=Join-Path $projectRoot 'target/x86_64-pc-windows-msvc/release/lecturerelay-desktop.exe'
if ($metadata) {
  # A hosted build can differ from the local MSVC build. Compare its own verified
  # payload hashes, not unrelated local EXE/worker bytes.
  $installedRoot=[IO.Path]::GetFullPath($testRoot)
  $actual=@('lecturerelay-desktop.exe')+@(Get-ChildItem -LiteralPath (Join-Path $testRoot 'local-asr'),(Join-Path $testRoot 'local-text') -Recurse -File | ForEach-Object { $_.FullName.Substring($installedRoot.Length+1).Replace('\','/') })
  $expected=@($metadata.payloadSha256.PSObject.Properties.Name)
  if (Compare-Object $expected $actual) { throw 'Installed CI payload file set differs' }
  foreach ($entry in $metadata.payloadSha256.PSObject.Properties) {
    $path=[IO.Path]::GetFullPath((Join-Path $testRoot $entry.Name))
    if (!$path.StartsWith($installedRoot+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid CI payload path' }
    if ((Get-SourceSha256 $path) -ne $entry.Value) { throw "Installed CI payload checksum differs: $($entry.Name)" }
  }
  & node.exe (Join-Path $PSScriptRoot 'windows-icons.mjs') $exe $icon
} else {
  # Verify the packaged release payload. A later debug build can legitimately
  # regenerate the shared staging worker with a different linker timestamp.
  & (Join-Path $PSScriptRoot 'runtime-resources.ps1') -RuntimePath (Join-Path $testRoot 'local-asr') -ExpectedRuntimePath (Join-Path (Split-Path $release -Parent) 'local-asr')
  & node.exe (Join-Path $PSScriptRoot 'windows-icons.mjs') $exe $icon $release
}
if ($LASTEXITCODE -ne 0) { throw 'EXE/icon verification failed' }
& node.exe (Join-Path $PSScriptRoot 'windows-icons.mjs') $InstallerPath $icon
if ($LASTEXITCODE -ne 0) { throw 'Installer icon verification failed' }
& node.exe (Join-Path $PSScriptRoot 'windows-icons.mjs') (Join-Path $testRoot 'uninstall.exe') $icon
if ($LASTEXITCODE -ne 0) { throw 'Uninstaller icon verification failed' }
$after=if (Test-Path -LiteralPath $data) { Get-SourceSha256 $data } else { $null }
if ($before -ne $after) { throw 'User database changed during installer verification' }
$report=[pscustomobject]@{
  Installer=$InstallerPath; Bytes=(Get-Item -LiteralPath $InstallerPath).Length
  Sha256=(Get-SourceSha256 $InstallerPath); InstallExit=$installed.ExitCode
  InstalledDirectory=$testRoot; Version=$version.ProductVersion
  RuntimeFiles=(Get-ChildItem -LiteralPath (Join-Path $testRoot 'local-asr') -Recurse -File | Measure-Object).Count
  RuntimeHashesMatch=$true; PhoenixVerified=$true; ReleaseExeVerified=$true; UserDatabaseUnchanged=$true
  CiSourceCommit=if ($metadata) { $metadata.sourceCommit } else { $null }
}
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'target/repository-cleanup') | Out-Null
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'target/repository-cleanup/installer-result.json') -Encoding UTF8
$report | ConvertTo-Json
