# Run the packaged CLI from any working directory. User paths remain relative to that directory.
$ErrorActionPreference = 'Stop'
$cliArguments = @($args)
if ($cliArguments.Count -gt 0 -and $cliArguments[0] -in @('prepare-donor', 'generate-screen', 'convert-package') -and $cliArguments -notcontains '--registry') {
    $cliArguments += @('--registry', (Join-Path $PSScriptRoot 'samples/donors.json'))
}
$dotnetExe = if ($env:EXUI_DOTNET_EXE) { $env:EXUI_DOTNET_EXE } else { 'dotnet' }
& $dotnetExe (Join-Path $PSScriptRoot 'cli/Extron.Cli.dll') @cliArguments
exit $LASTEXITCODE
