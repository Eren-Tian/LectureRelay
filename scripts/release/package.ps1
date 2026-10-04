$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $projectRoot 'scripts/verification/file-hash.ps1')
$releaseVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json).version
foreach ($manifest in @('package.json', 'apps/desktop/package.json')) {
  if ((Get-Content -LiteralPath (Join-Path $projectRoot $manifest) -Raw | ConvertFrom-Json).version -ne $releaseVersion) { throw "Version mismatch: $manifest" }
}
if ($releaseVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Expected a stable numeric release version' }
Push-Location $projectRoot
try {
  & pnpm.cmd build
  if ($LASTEXITCODE -ne 0) { throw 'Release build failed' }
  & (Join-Path $projectRoot 'scripts/verification/runtime-resources.ps1')
  $installer = Join-Path $projectRoot "target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_${releaseVersion}_x64-setup.exe"
  if (!(Test-Path -LiteralPath $installer)) { throw 'Expected installer is missing' }
  $hash = Get-SourceSha256 $installer
  Set-Content -LiteralPath ($installer+'.sha256') -Value "$hash  $([IO.Path]::GetFileName($installer))" -Encoding ascii
  Write-Output $installer
} finally { Pop-Location }
