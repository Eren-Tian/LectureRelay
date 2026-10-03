$ErrorActionPreference='Stop'
$root=Get-Location
$sdk=Join-Path $root 'target/asr-evaluation/nemo'
if (!(Test-Path -LiteralPath $sdk)) { $sdk=Join-Path $root 'target/native/speech-worker/nemo' }
$out=Join-Path $root 'target/asr-evaluation/nemo-worker'
New-Item -ItemType Directory -Path $out -Force | Out-Null
Get-ChildItem (Join-Path $sdk 'bin') -Filter '*.dll' | Copy-Item -Destination $out
$vswhere="${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs=& $vswhere -latest -products '*' -property installationPath
$vcvars=Join-Path $vs 'VC/Auxiliary/Build/vcvars64.bat'
$source=Join-Path $root 'experiments/local-stt/native/nemo-worker.cpp'
$driver=Join-Path $out 'build.cmd'
$command='@call "{0}"' -f $vcvars
$command+="`r`n"+('@cl /nologo /O2 /EHsc /utf-8 /std:c++17 /MT /I"{0}\include" "{1}" /Fe:"{2}\asr-worker.exe" /Fo:"{2}\asr-worker.obj"' -f $sdk,$source,$out)
Set-Content -LiteralPath $driver -Value $command -Encoding ascii
& cmd.exe /d /c $driver
if($LASTEXITCODE -ne 0){throw 'Native Nemo driver build failed'}
