$ErrorActionPreference = 'Stop'
$LectureRelayRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$LectureRelayTools = Join-Path $LectureRelayRoot '.tools'
$LectureRelayDownloads = Join-Path $LectureRelayTools 'downloads'
. (Join-Path $LectureRelayRoot 'scripts/verification/file-hash.ps1')

& (Join-Path $PSScriptRoot 'check-env.ps1') -PrerequisitesOnly

New-Item -ItemType Directory -Path $LectureRelayDownloads -Force | Out-Null
$env:CARGO_HOME = Join-Path $LectureRelayTools 'cargo'
$env:RUSTUP_HOME = Join-Path $LectureRelayTools 'rustup'
$rustupExecutable = Join-Path $env:CARGO_HOME 'bin\rustup.exe'

if (-not (Test-Path -LiteralPath $rustupExecutable)) {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $installer = Join-Path $LectureRelayDownloads 'rustup-init.exe'
  $url = 'https://static.rust-lang.org/rustup/archive/1.29.1/x86_64-pc-windows-msvc/rustup-init.exe'
  Invoke-WebRequest -Uri $url -OutFile $installer -UseBasicParsing
  $expectedHash = '6F4BEF66261261FCB43131BE8720BAB817D403A09EDEC7455C371974B90BDB7E'
  if ((Get-SourceSha256 $installer) -ne $expectedHash) {
    throw 'Rustup installer SHA-256 verification failed'
  }
  & $installer -y --no-modify-path --default-host x86_64-pc-windows-msvc --default-toolchain 1.98.1 --profile minimal --component rustfmt --component clippy
  if ($LASTEXITCODE -ne 0) { throw 'Rust installation failed' }
}

. (Join-Path $PSScriptRoot 'activate.ps1')
& rustup.exe toolchain install 1.98.1 --profile minimal --component rustfmt --component clippy --target x86_64-pc-windows-msvc
if ($LASTEXITCODE -ne 0) { throw 'Rust toolchain installation failed' }

Push-Location $LectureRelayRoot
try {
  if (Test-Path -LiteralPath 'pnpm-lock.yaml') {
    & pnpm.cmd install --frozen-lockfile
  } else {
    & pnpm.cmd install
  }
  if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
  & cargo.exe fetch --locked
  if ($LASTEXITCODE -ne 0) { throw 'Rust dependency download failed' }
  & (Join-Path $PSScriptRoot 'check-env.ps1')
} finally {
  Pop-Location
}
