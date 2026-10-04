$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location $projectRoot
try {
  $node = (Get-Content -LiteralPath '.node-version' -Raw).Trim()
  if ((& node --version) -ne "v$node") { throw 'Node differs from .node-version' }
  $manager = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).packageManager
  if ($manager -notmatch '^pnpm@([0-9.]+)$') { throw 'Expected exact pnpm pin' }
  $pnpmVersion = $Matches[1]
  & npm.cmd install --global $manager
  if ($LASTEXITCODE -ne 0) { throw 'pnpm installation failed' }
  if ((& pnpm.cmd --version) -ne $pnpmVersion) { throw 'pnpm version mismatch' }
  $toolchain = Get-Content -LiteralPath 'rust-toolchain.toml' -Raw
  if ($toolchain -notmatch 'channel\s*=\s*"([0-9.]+)"') { throw 'Expected exact Rust pin' }
  $rustVersion = $Matches[1]
  & rustup toolchain install $rustVersion --profile minimal --component rustfmt --component clippy --target x86_64-pc-windows-msvc
  if ($LASTEXITCODE -ne 0) { throw 'Pinned Rust installation failed' }
  & rustc --version --verbose
  if ($LASTEXITCODE -ne 0) { throw 'Pinned Rust cannot run' }
  & cargo --version
  if ($LASTEXITCODE -ne 0) { throw 'Pinned Cargo cannot run' }
} finally { Pop-Location }
