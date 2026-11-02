[CmdletBinding()]
param(
    [string]$MatlabRoot = 'C:\Program Files\MATLAB\R2026b',
    [string]$WorkspacePath = (Split-Path $PSScriptRoot -Parent),
    [switch]$RegisterCodex
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$binary = Join-Path $projectRoot 'bin\matlab-mcp-server-windows-x64.exe'
$version = 'v0.16.0'
$expectedHash = '7C70FDC69E7E7D4762732FEDE64F348B18ECBC89C3DE705F9DDE89A86D1883EA'
if (-not (Test-Path -LiteralPath (Join-Path $MatlabRoot 'bin\matlab.exe'))) {
    throw "MATLAB not found at $MatlabRoot. Supply -MatlabRoot."
}
$WorkspacePath = (Resolve-Path -LiteralPath $WorkspacePath).Path
New-Item -ItemType Directory -Force (Split-Path $binary) | Out-Null
New-Item -ItemType Directory -Force (Join-Path $projectRoot 'artifacts') | Out-Null
if (-not (Test-Path -LiteralPath $binary)) {
    Invoke-WebRequest "https://github.com/matlab/matlab-mcp-server/releases/download/$version/matlab-mcp-server-windows-x64.exe" -OutFile $binary
}
if ((Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash -ne $expectedHash) {
    throw 'Server checksum mismatch. Do not execute this binary.'
}
$signature = Get-AuthenticodeSignature -LiteralPath $binary
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O="?The MathWorks, Inc\.') {
    throw 'A valid MathWorks signature is required.'
}
& $binary --version
if ($LASTEXITCODE -ne 0) { throw 'Server version check failed.' }

$commandToml = ConvertTo-Json -InputObject $binary -Compress
$argsToml = ConvertTo-Json -InputObject @("--matlab-root=$MatlabRoot", "--initial-working-folder=$WorkspacePath", '--matlab-display-mode=nodesktop', '--matlab-session-mode=new', '--disable-telemetry=true') -Compress
$configBlock = @"
[mcp_servers.matlab]
command = $commandToml
args = $argsToml
env_vars = ["WINDIR"]
startup_timeout_sec = 120
tool_timeout_sec = 300
"@
Set-Content -LiteralPath (Join-Path $projectRoot 'artifacts\codex-config.toml') -Value $configBlock -Encoding utf8
if ($RegisterCodex) {
    $codexHomePath = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
    $configPath = Join-Path $codexHomePath 'config.toml'
    $existing = if (Test-Path -LiteralPath $configPath) { [IO.File]::ReadAllText($configPath) } else { '' }
    if ($existing -match '(?m)^\s*\[mcp_servers\.matlab(?:\]|\.)') {
        throw "MATLAB is already configured in $configPath. Review the generated artifacts\codex-config.toml rather than overwriting it."
    }
    New-Item -ItemType Directory -Force $codexHomePath | Out-Null
    if (Test-Path -LiteralPath $configPath) {
        Copy-Item -LiteralPath $configPath -Destination ($configPath + '.before-matlab-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.bak')
    }
    [IO.File]::AppendAllText($configPath, "`r`n$configBlock`r`n", [Text.UTF8Encoding]::new($false))
    Write-Host "Registered MATLAB MCP in $configPath. Restart Codex to load its tools."
} else {
    Write-Host 'Verified server. Use -RegisterCodex to register it; generated config is in artifacts\codex-config.toml.'
}
