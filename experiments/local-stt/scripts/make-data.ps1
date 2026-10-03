$ErrorActionPreference = 'Stop'
$destination = Join-Path (Get-Location) 'target/asr-evaluation/benchmark-data'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice.SelectVoice('Microsoft David Desktop')
$voice.Rate = -1
$texts = [ordered]@{
  lecture = 'Today we will examine why observations close together in space may be more similar than observations far apart. A statistical association does not establish causation. We need to compare the proposed explanation with alternative mechanisms and consider the assumptions behind the experiment. When we change the scale of measurement, the result can also change.'
  gis = "Moran's I measures global spatial autocorrelation. Getis Ord G I star identifies local clusters. Geographically weighted regression allows relationships to vary across space. Landsat imagery can inform Geo A I models, but spatial heterogeneity remains important."
  cs = 'CUDA kernels execute on the graphics processor. Shared memory and occupancy affect performance. A transformer uses self attention to combine information from tokens. Kernel synchronization and memory bandwidth can limit parallel speed.'
  biology = 'CRISPR Cas nine can modify a targeted DNA sequence. Epigenetics studies changes in gene regulation. RNA polymerase synthesizes RNA during transcription. A transcription factor binds regulatory DNA and changes gene expression.'
}
foreach ($name in $texts.Keys) {
  $voice.SetOutputToWaveFile((Join-Path $destination "$name-original.wav"))
  $voice.Speak($texts[$name])
  $voice.SetOutputToNull()
}
$texts | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'references.json') -Encoding utf8
$voice.Dispose()
