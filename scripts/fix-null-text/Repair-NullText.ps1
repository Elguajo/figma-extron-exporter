# Repair a GDL exported before f21bd48: passive controls with a null Text leave the whole
# page blank in Global Configurator Plus. Writes "<name> text-fix.gdl" next to the input,
# never overwrites. The result has no .tgz4: open it in GUI Designer and Save and Build.
#   powershell -ExecutionPolicy Bypass -File scripts/fix-null-text/Repair-NullText.ps1 "D:\...\project.gdl"
param([Parameter(Mandatory)][string]$Gdl, [string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$src = (Resolve-Path -LiteralPath $Gdl).Path
$dst = Join-Path (Split-Path $src) ([IO.Path]::GetFileNameWithoutExtension($src) + ' text-fix.gdl')
if (Test-Path -LiteralPath $dst) { throw "Refusing to overwrite '$dst'." }
$ps32 = Join-Path $env:windir 'SysWOW64\WindowsPowerShell\v1.0\powershell.exe'
$work = Join-Path ([IO.Path]::GetTempPath()) ('fix-null-text-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work | Out-Null
try {
    $in = Join-Path $work 'in.ProjectGCP'; $out = Join-Path $work 'out.ProjectGCP'
    & $Python -I (Join-Path $PSScriptRoot 'gdl_container.py') extract $src $in
    if ($LASTEXITCODE) { throw 'extract failed' }
    & $ps32 -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'Fix-NullTextPayload.ps1') -In $in -Out $out
    if ($LASTEXITCODE -or -not (Test-Path -LiteralPath $out)) { throw 'payload fix failed' }
    & $Python -I (Join-Path $PSScriptRoot 'gdl_container.py') repack $src $out $dst
    if ($LASTEXITCODE) { throw 'repack failed' }
    "Next: open '$dst' in GUI Designer, Save and Build, then import into GCP."
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}
