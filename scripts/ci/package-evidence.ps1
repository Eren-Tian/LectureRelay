$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or !$env:ImageVersion) { throw 'Cold-build evidence requires a GitHub-hosted image' }
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
. (Join-Path $projectRoot 'scripts/verification/file-hash.ps1')
Push-Location $projectRoot
try {
  $source = git rev-parse HEAD
  if ($source -ne $env:EXPECTED_SOURCE_SHA) { throw 'Source changed during packaging' }
  $lockChanges = git diff --exit-code -- Cargo.lock pnpm-lock.yaml
  if ($LASTEXITCODE -ne 0) { throw 'A dependency lockfile changed during packaging' }
  $verified = Get-Content 'target/repository-cleanup/installer-result.json' -Raw | ConvertFrom-Json
  if (!$verified.RuntimeHashesMatch -or !$verified.ReleaseExeVerified -or !$verified.PhoenixVerified -or !$verified.UserDatabaseUnchanged) { throw 'Installed verification is incomplete' }
  $installer = $verified.Installer
  $sha = Get-SourceSha256 $installer
  if ($sha -ne $verified.Sha256) { throw 'Installer changed after verification' }
  $manifests = @{}
  foreach ($name in @('Cargo.lock','pnpm-lock.yaml','rust-toolchain.toml','.node-version','apps/desktop/native/speech-worker/runtime.json','scripts/build/prepare-asr.mjs','scripts/build/prepare-text-runtime.mjs','apps/desktop/src-tauri/resources/local-text/runtime-manifest.json')) {
    $manifests[$name] = Get-SourceSha256 $name
  }
  $vswhere = "${env:ProgramFiles(x86)}/Microsoft Visual Studio/Installer/vswhere.exe"
  $vs = & $vswhere -latest -products '*' -format json | ConvertFrom-Json
  $evidence = [ordered]@{
    sourceCommit=$source; version=$verified.Version; coldBuild=$true; restoredProjectOrDependencyCaches=$false
    runUrl="https://github.com/$env:GITHUB_REPOSITORY/actions/runs/$env:GITHUB_RUN_ID"
    runner=@{label='windows-2025';imageOS=$env:ImageOS;imageVersion=$env:ImageVersion;os=[Environment]::OSVersion.VersionString}
    toolchain=@{node=(& node --version);pnpm=(& pnpm.cmd --version);rust=(& rustc --version);cargo=(& cargo --version);visualStudio=@($vs | Select-Object installationVersion,displayName)}
    manifestSha256=$manifests; installer=@{name=[IO.Path]::GetFileName($installer);bytes=(Get-Item $installer).Length;sha256=$sha}
    verification=@{installedRuntimeHashes=$true;releasePayload=$true;icons=$true;licensesAndNotices=$true;databaseUnchanged=$true}
    executed=@('Frozen pnpm install','Locked Tauri/Cargo release build','Native worker build','NSIS installation','Resource/license/icon/payload verification')
    exclusions=@('Ordinary regressions run in the separate Windows checks job','Model weights and inference','Hardware audio capture','Installed classroom GUI','90-minute continuity','Signing','Fresh WebView2 bootstrap')
    reproducibility='One cold hosted build; byte-for-byte reproducibility is not claimed.'
  }
  $output=Join-Path $projectRoot 'target/ci-package'
  New-Item -ItemType Directory -Force -Path $output | Out-Null
  Copy-Item -LiteralPath $installer,($installer+'.sha256') -Destination $output
  $evidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $output 'build-metadata.json') -Encoding utf8
  "## Cold Windows installer`nSource: $source`n`nInstaller SHA-256: $sha`n`nRuntime, icons and notices verified. No dependency caches or model weights used. See build-metadata.json for scope." >> $env:GITHUB_STEP_SUMMARY
} finally { Pop-Location }
