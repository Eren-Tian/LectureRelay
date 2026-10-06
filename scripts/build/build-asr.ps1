$ErrorActionPreference='Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$sdk = Join-Path $projectRoot 'target/native/speech-worker/nemo'
if (!(Test-Path -LiteralPath (Join-Path $sdk 'include/nemo_speech/asr.h'))) { throw 'Run pnpm build:asr first to download the pinned native SDK.' }
$out = Join-Path $projectRoot 'apps/desktop/src-tauri/resources/local-asr'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$runtime = Get-Content -LiteralPath (Join-Path $projectRoot 'apps/desktop/native/speech-worker/runtime.json') -Raw | ConvertFrom-Json
# Remove only old generated DLLs in this exact staging folder. Preserve all SDK/cache inputs.
$resolvedOut = (Resolve-Path -LiteralPath $out).Path
$expectedOut = [IO.Path]::GetFullPath((Join-Path $projectRoot 'apps/desktop/src-tauri/resources/local-asr'))
if ($resolvedOut -ne $expectedOut -or !$resolvedOut.StartsWith($projectRoot+'\')) { throw 'Unexpected staging directory' }
Get-ChildItem -LiteralPath $resolvedOut -Filter '*.dll' -File | Where-Object { $_.Name -notin $runtime.dlls } | ForEach-Object { Remove-Item -LiteralPath $_.FullName }
foreach ($dll in $runtime.dlls) { Copy-Item -LiteralPath (Join-Path $sdk "bin/$dll") -Destination $out -Force }
$licenses = [IO.Path]::GetFullPath((Join-Path $resolvedOut 'licenses'))
if ($licenses -ne (Join-Path $expectedOut 'licenses') -or !$licenses.StartsWith($projectRoot+'\')) { throw 'Unexpected generated license directory' }
# Copying a directory onto an existing directory nests a duplicate notice tree on Windows.
if (Test-Path -LiteralPath $licenses) { Remove-Item -LiteralPath $licenses -Recurse -Force }
Copy-Item -LiteralPath (Join-Path $sdk 'share/licenses/nemo-speech') -Destination $licenses -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/licenses/NVIDIA-Open-Model-License.pdf') -Destination (Join-Path $out 'licenses') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/licenses/NVIDIA-Model-NOTICE.txt') -Destination (Join-Path $out 'licenses') -Force
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -products '*' -property installationPath
$vcvars = Join-Path $vs 'VC/Auxiliary/Build/vcvars64.bat'
$source = Join-Path $projectRoot 'apps/desktop/native/speech-worker/src/main.cpp'
$driver = Join-Path $projectRoot 'target/native/speech-worker/build-worker.cmd'
$object = Join-Path $projectRoot 'target/native/speech-worker/asr-worker.obj'
$worker = Join-Path $projectRoot 'target/native/speech-worker/asr-worker.exe'
$testSource = Join-Path $projectRoot 'apps/desktop/native/speech-worker/tests/endpoint.cpp'
$testExe = Join-Path $projectRoot 'target/native/speech-worker/endpoint-test.exe'
$testObject = Join-Path $projectRoot 'target/native/speech-worker/endpoint-test.obj'
$command = '@call "{0}"' -f $vcvars
$command += "`r`n" + ('@cl /nologo /O2 /EHsc /utf-8 /std:c++17 /MT /I"{0}\include" "{1}" /Fe:"{2}" /Fo:"{3}"' -f $sdk,$source,$worker,$object)
$command += "`r`n@if errorlevel 1 exit /b 1"
$command += "`r`n" + ('@cl /nologo /O2 /EHsc /std:c++17 /MT "{0}" /Fe:"{1}" /Fo:"{2}"' -f $testSource,$testExe,$testObject)
$command += "`r`n@if errorlevel 1 exit /b 1"
$command += "`r`n" + ('@"{0}"' -f $testExe)
Set-Content -LiteralPath $driver -Value $command -Encoding ascii
& cmd.exe /d /c $driver
if ($LASTEXITCODE -ne 0) { throw 'Native speech worker build failed' }
Copy-Item -LiteralPath $worker -Destination (Join-Path $out 'asr-worker.exe') -Force
