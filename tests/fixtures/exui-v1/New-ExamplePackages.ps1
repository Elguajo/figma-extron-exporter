param([string]$OutputDirectory = 'output/exui-v1/packages')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$destination = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($destination) | Out-Null
foreach ($profile in '1025m', '300m') {
    $source = Join-Path $PSScriptRoot $profile
    $target = Join-Path $destination "first-screen-$profile.exui"
    # CreateNew and fixed metadata: never overwrite; reproducible on the same .NET runtime.
    $file = [IO.File]::Open($target, [IO.FileMode]::CreateNew)
    try {
        $zip = [IO.Compression.ZipArchive]::new($file, [IO.Compression.ZipArchiveMode]::Create, $true)
        try {
            $names = @('manifest.json', 'screen.json') + @(
                Get-ChildItem -LiteralPath (Join-Path $source 'assets') -File | Sort-Object Name | ForEach-Object { 'assets/' + $_.Name }
            )
            foreach ($name in $names) {
                $entry = $zip.CreateEntry($name, [IO.Compression.CompressionLevel]::Optimal)
                $entry.LastWriteTime = [DateTimeOffset]::new(2000, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
                $stream = $entry.Open()
                try { $bytes = [IO.File]::ReadAllBytes((Join-Path $source $name)); $stream.Write($bytes, 0, $bytes.Length) }
                finally { $stream.Dispose() }
            }
        } finally { $zip.Dispose() }
    } finally { $file.Dispose() }
    Get-FileHash -LiteralPath $target -Algorithm SHA256
}
