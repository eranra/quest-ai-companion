param(
  [string]$Text = "Hello from the Quest AI companion PC server! This is genuine human speech.",
  [string]$VoiceId = "",
  [string]$OutputFile = ""
)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

try {
  if ($VoiceId -match "male|alex|ryan|guy|david") {
    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Male)
  } else {
    $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::Female)
  }
} catch {}

try {
  $synth.Rate = 1
} catch {}

if ($OutputFile) {
  $synth.SetOutputToWaveFile($OutputFile)
  $synth.Speak($Text)
  $synth.Dispose()
  Write-Output "OK"
} else {
  $ms = New-Object System.IO.MemoryStream
  $synth.SetOutputToWaveStream($ms)
  $synth.Speak($Text)
  $bytes = $ms.ToArray()
  $base64 = [Convert]::ToBase64String($bytes)
  $synth.Dispose()
  $ms.Dispose()
  Write-Output $base64
}
