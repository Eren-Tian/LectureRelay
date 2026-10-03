param([string]$InstallerPath)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $PSScriptRoot 'file-hash.ps1')
if (!$InstallerPath) { $InstallerPath=Join-Path $projectRoot 'target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_0.3.1_x64-setup.exe' }
$testRoot=Join-Path $projectRoot ('target/installer-cleanup-'+[Guid]::NewGuid().ToString())
$data=Join-Path $env:LOCALAPPDATA 'LectureRelay/app.db'
$before=if (Test-Path -LiteralPath $data) { Get-SourceSha256 $data } else { $null }
# NSIS /D must be last and unquoted. Install only to a fresh isolated target directory.
$installed=Start-Process -FilePath $InstallerPath -ArgumentList "/S /D=$testRoot" -WindowStyle Hidden -PassThru -Wait
if ($installed.ExitCode -ne 0) { throw "Installer failed: $($installed.ExitCode)" }
$exe=Join-Path $testRoot 'lecturerelay-desktop.exe'
$version=[Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
if ($version.ProductVersion -notmatch '^0\.3\.1') { throw 'Installed application version differs' }
& (Join-Path $PSScriptRoot 'runtime-resources.ps1') -RuntimePath (Join-Path $testRoot 'local-asr')
$icon=Join-Path $projectRoot 'apps/desktop/src-tauri/icons/icon.ico'
$release=Join-Path $projectRoot 'target/x86_64-pc-windows-msvc/release/lecturerelay-desktop.exe'
& node.exe (Join-Path $PSScriptRoot 'windows-icons.mjs') $exe $icon $release
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
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $projectRoot 'target/repository-cleanup/installer-result.json') -Encoding UTF8
$report | ConvertTo-Json
