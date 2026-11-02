[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$ScriptPath,
    [string]$MatlabRoot = 'C:\Program Files\MATLAB\R2026b',
    [ValidateRange(10,3600)][int]$TimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $ScriptPath).Path
$item = Get-Item -LiteralPath $source
if ($item.PSIsContainer -or $item.Extension.ToLowerInvariant() -notin @('.m','.mlx')) {
    throw 'Supply a MATLAB .m or .mlx file.'
}
if ($item.BaseName -notmatch '^[A-Za-z][A-Za-z0-9_]{0,62}$') {
    throw 'MATLAB needs a valid script name. Save a version such as analysis_copy_2.mlx (letters, digits and underscores; at most 63 characters).'
}
$matlab = Join-Path $MatlabRoot 'bin\matlab.exe'
if (-not (Test-Path -LiteralPath $matlab)) { throw "MATLAB not found: $matlab" }
if ($source -match '[\r\n]' -or $PSScriptRoot -match '[\r\n]') { throw 'Paths cannot contain line breaks.' }
$artifacts = Join-Path (Split-Path $PSScriptRoot -Parent) 'artifacts'
New-Item -ItemType Directory -Force $artifacts | Out-Null
$runId = [Guid]::NewGuid().ToString('N')
$statusPath = Join-Path $artifacts "desktop-$runId.txt"
$wrapperPath = Join-Path $artifacts "mcp_desktop_$runId.m"
$sourceLiteral = $source.Replace("'","''")
$statusLiteral = $statusPath.Replace("'","''")
$wrapperLiteral = $wrapperPath.Replace("'","''")
# Literal paths survive scripts that clear their caller workspace.
$code = @"
try
    run('$sourceLiteral');
    open('$sourceLiteral');
    drawnow;
    mcpStatusFile = fopen('$statusLiteral','w');
    assert(mcpStatusFile >= 0,'Could not write run status.');
    fprintf(mcpStatusFile,'SUCCESS: MATLAB script completed.');
    fclose(mcpStatusFile);
catch mcpRunError
    disp(getReport(mcpRunError,'extended'));
    mcpStatusFile = fopen('$statusLiteral','w');
    if mcpStatusFile >= 0
        fprintf(mcpStatusFile,'ERROR: %s',getReport(mcpRunError,'extended'));
        fclose(mcpStatusFile);
    end
end
"@
Set-Content -LiteralPath $wrapperPath -Value $code -Encoding utf8
# The caller explicitly requests an interactive MATLAB desktop; leave it open.
Start-Process -FilePath $matlab -ArgumentList @('-desktop','-r',('"run(''' + $wrapperLiteral + ''');"')) | Out-Null
Write-Host "Started MATLAB desktop. Status: $statusPath"
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if ((Test-Path -LiteralPath $statusPath) -and (Get-Item -LiteralPath $statusPath).Length -gt 0) {
        $status = [IO.File]::ReadAllText($statusPath)
        if ($status.StartsWith('SUCCESS:')) { Write-Host $status; return }
        if ($status.StartsWith('ERROR:')) { throw $status }
    }
    Start-Sleep -Seconds 1
}
throw "Timed out waiting for MATLAB; execution may still be running. Inspect MATLAB before retrying. Status: $statusPath"
