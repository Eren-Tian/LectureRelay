$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$browser = @("${env:ProgramFiles(x86)}/Microsoft/Edge/Application/msedge.exe", "$env:ProgramFiles/Microsoft/Edge/Application/msedge.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$browser) { throw 'Microsoft Edge is required for headless React tests' }
$version = [Diagnostics.FileVersionInfo]::GetVersionInfo($browser).ProductVersion
if ($version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Cannot determine Edge version' }
$directory = Join-Path $projectRoot 'target/component-tools'
$driver = Join-Path $directory 'msedgedriver.exe'
$existing = if (Test-Path -LiteralPath $driver) { (& $driver --version) } else { '' }
if ($existing -notmatch [regex]::Escape($version)) {
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $archive = Join-Path $directory 'driver.zip'
  Invoke-WebRequest -Uri "https://msedgedriver.microsoft.com/$version/edgedriver_win64.zip" -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $directory -Force
}
& $driver --version
if ($LASTEXITCODE -ne 0) { throw 'Component WebDriver failed to start' }
Write-Output "Browser: $version"
