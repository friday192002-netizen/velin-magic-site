$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$pythonExecutable = if (Test-Path -LiteralPath $bundledPython) { $bundledPython } else { (Get-Command python -ErrorAction Stop).Source }
& $pythonExecutable (Join-Path $PSScriptRoot 'build.py')
if ($LASTEXITCODE -ne 0) { throw 'Build failed. See the output above.' }
$previewUrl = 'http://127.0.0.1:4321/'
$running = $false
try {
    $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
    $running = $response.StatusCode -eq 200 -and $response.Content.Contains('Velin')
} catch { }
if (-not $running) {
    Start-Process -FilePath $pythonExecutable -ArgumentList @('"' + (Join-Path $PSScriptRoot 'serve.py') + '"', '4321') -WorkingDirectory $projectRoot -WindowStyle Hidden
}
Start-Process $previewUrl
