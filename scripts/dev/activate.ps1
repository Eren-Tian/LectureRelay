# Dot-source this file to use project-local Rust in the current terminal.
$LectureRelayRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$LectureRelayCargoRoot = Join-Path $LectureRelayRoot '.tools\cargo'
if (Test-Path -LiteralPath (Join-Path $LectureRelayCargoRoot 'bin\rustup.exe')) {
  $env:CARGO_HOME = $LectureRelayCargoRoot
  $env:RUSTUP_HOME = Join-Path $LectureRelayRoot '.tools\rustup'
  $LectureRelayCargoBin = Join-Path $LectureRelayCargoRoot 'bin'
  if (($env:Path -split ';') -notcontains $LectureRelayCargoBin) {
    $env:Path = "$LectureRelayCargoBin;$env:Path"
  }
}
$env:CARGO_TARGET_DIR = Join-Path $LectureRelayRoot 'target'
