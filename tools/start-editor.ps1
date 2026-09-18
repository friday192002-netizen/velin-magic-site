$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) {
    $pythonExecutable = $bundledPython
} else {
    $pythonExecutable = (Get-Command python -ErrorAction Stop).Source
}
$managerUrl = 'http://127.0.0.1:4323/__media/'
try {
    $existing = Invoke-WebRequest -Uri $managerUrl -UseBasicParsing -TimeoutSec 2
    if ($existing.StatusCode -eq 200 -and $existing.Content.Contains('Velin')) {
        Start-Process $managerUrl
        exit
    }
} catch { }
Start-Process -FilePath $pythonExecutable -ArgumentList @('"' + (Join-Path $PSScriptRoot 'media_server.py') + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden
