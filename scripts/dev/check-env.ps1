param([switch]$PrerequisitesOnly)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'activate.ps1')
$LectureRelayFailures = @()

function Write-Check {
  param([string]$Name, [bool]$Passed, [string]$Detail)
  if ($Passed) {
    Write-Host "[OK] $Name - $Detail"
  } else {
    Write-Host "[FAIL] $Name - $Detail" -ForegroundColor Red
    $script:LectureRelayFailures += $Name
  }
}

Write-Check 'Windows x64' ([Environment]::OSVersion.Platform -eq 'Win32NT' -and [Environment]::Is64BitOperatingSystem) 'x86_64-pc-windows-msvc target'

$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodeVersionText = (& node.exe --version).Trim()
  $nodeVersion = [version]$nodeVersionText.TrimStart('v')
  Write-Check 'Node.js' ($nodeVersion -ge [version]'24.15.0' -and $nodeVersion.Major -eq 24) $nodeVersionText
} else {
  Write-Check 'Node.js' $false 'Install Node.js 24 LTS (24.15.0 or newer within 24.x)'
}

$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
if ($pnpmCommand) {
  $pnpmVersion = (& pnpm.cmd --version).Trim()
  Write-Check 'pnpm' ($pnpmVersion -eq '11.25.0') $pnpmVersion
} else {
  Write-Check 'pnpm' $false 'Install pnpm 11.25.0'
}

$gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
Write-Check 'Git' ([bool]$gitCommand) 'Required for source control'

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$visualStudio = $null
if (Test-Path -LiteralPath $vswhere) {
  $visualStudio = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
Write-Check 'MSVC C++ Build Tools' ([bool]$visualStudio) "$visualStudio"

$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Lib'
$sdkVersions = @(Get-ChildItem -LiteralPath $sdk -Directory -ErrorAction SilentlyContinue | Where-Object {
  Test-Path -LiteralPath (Join-Path $_.FullName 'um\x64\kernel32.lib')
})
Write-Check 'Windows SDK' ($sdkVersions.Count -gt 0) ($sdkVersions.Name -join ', ')

$webview = @(Get-ItemProperty -Path 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*','HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\*' -ErrorAction SilentlyContinue | Where-Object {
  $_.name -eq 'Microsoft Edge WebView2 Runtime' -and $_.pv -ne '0.0.0.0'
})
Write-Check 'WebView2 Runtime' ($webview.Count -gt 0) (($webview | Select-Object -ExpandProperty pv) -join ', ')

if (-not $PrerequisitesOnly) {
  $rustupCommand = Get-Command rustup.exe -ErrorAction SilentlyContinue
  if ($rustupCommand) {
    $installed = (& rustup.exe toolchain list) -join ' '
    Write-Check 'Rust MSVC toolchain' ($installed -match '1\.98\.1-x86_64-pc-windows-msvc') $installed
    if ($installed -match '1\.98\.1-x86_64-pc-windows-msvc') {
      $components = (& rustup.exe component list --toolchain 1.98.1-x86_64-pc-windows-msvc --installed) -join ' '
      Write-Check 'rustfmt and clippy' ($components -match 'rustfmt' -and $components -match 'clippy') 'Formatting and native lint tools'
      & rustc.exe --version
      & cargo.exe --version
    }
  } else {
    Write-Check 'Rust MSVC toolchain' $false 'Run pnpm run setup'
  }
  Write-Check 'Frontend dependencies' (Test-Path -LiteralPath (Join-Path $LectureRelayRoot 'apps\desktop\node_modules\vite\package.json')) 'pnpm workspace installation'
}

if ($LectureRelayFailures.Count -gt 0) {
  throw "Environment checks failed: $($LectureRelayFailures -join ', ')"
}
Write-Host 'Development environment checks passed.' -ForegroundColor Green
