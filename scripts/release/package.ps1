$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $projectRoot 'scripts/verification/file-hash.ps1')
Push-Location $projectRoot
try {
  & pnpm.cmd build
  if ($LASTEXITCODE -ne 0) { throw 'Release build failed' }
  & (Join-Path $projectRoot 'scripts/verification/runtime-resources.ps1')
  $installer = Join-Path $projectRoot 'target/x86_64-pc-windows-msvc/release/bundle/nsis/LectureRelay_0.2.0_x64-setup.exe'
  if (!(Test-Path -LiteralPath $installer)) { throw 'Expected installer is missing' }
  $hash = Get-SourceSha256 $installer
  Set-Content -LiteralPath ($installer+'.sha256') -Value "$hash  $([IO.Path]::GetFileName($installer))" -Encoding ascii
  Write-Output $installer
} finally { Pop-Location }
