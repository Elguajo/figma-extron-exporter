[CmdletBinding()]
param(
    [string] $OutputDirectory,
    [string] $DotnetExe = 'dotnet',
    [switch] $IncludeLocalSamples
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 adds a BOM for -Encoding utf8; Node's JSON.parse rejects it.
function Write-Utf8NoBom { param([string] $Path) process { [IO.File]::WriteAllText($Path, $_, [Text.UTF8Encoding]::new($false)) } }
$repo = Split-Path $PSScriptRoot -Parent
$plugin = Join-Path $repo 'src/figma-plugin'
$pluginPackage = Get-Content -Raw -LiteralPath (Join-Path $plugin 'package.json') | ConvertFrom-Json
$version = $pluginPackage.version
$cliProject = [xml](Get-Content -Raw -LiteralPath (Join-Path $repo 'src/cli/Extron.Cli.csproj'))
$cliVersion = [string]($cliProject.Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1)
if (!$cliVersion) { throw 'CLI project must declare its release version' }
if ($pluginPackage.compatibleCliVersion -and [version]$cliVersion -lt [version]$pluginPackage.compatibleCliVersion) { throw 'CLI version is older than the plugin requires' }
$sourceCommit = (& git -C $repo rev-parse HEAD)
$sourceDirty = @(& git -C $repo status --porcelain).Count -gt 0
if (!$OutputDirectory) { $OutputDirectory = Join-Path $repo "output/releases/$version" }
$OutputDirectory = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDirectory)
$pluginZip = Join-Path $OutputDirectory "figma-extron-plugin-$version.zip"
$cliZip = Join-Path $OutputDirectory "figma-extron-cli-$cliVersion-windows.zip"
$localZip = Join-Path $OutputDirectory "figma-extron-complete-$version-local.zip"
foreach ($file in @($pluginZip, $cliZip) + $(if ($IncludeLocalSamples) { @($localZip) } else { @() })) {
    if (Test-Path -LiteralPath $file) { throw "Refusing to replace $file" }
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stage = Join-Path $OutputDirectory ('stage-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null

& npm run build --prefix $plugin
if ($LASTEXITCODE -ne 0) { throw 'Plugin build failed' }
& node (Join-Path $plugin 'package-plugin.mjs') $pluginZip
if ($LASTEXITCODE -ne 0) { throw 'Plugin packaging failed' }
& $DotnetExe publish (Join-Path $repo 'src/cli/Extron.Cli.csproj') --no-restore --configuration Release --self-contained false -p:UseAppHost=false "-p:Version=$cliVersion" --output (Join-Path $stage 'cli')
if ($LASTEXITCODE -ne 0) { throw 'CLI publish failed' }
if (!(Test-Path -LiteralPath (Join-Path $stage 'cli/host/ExtronAdapterHost.ps1'))) { throw 'Published adapter host is missing' }
if (!(Test-Path -LiteralPath (Join-Path $stage 'cli/compatibility/extron.json'))) { throw 'Published compatibility profiles are missing' }
$compatibility = Get-Content -Raw -LiteralPath (Join-Path $stage 'cli/compatibility/extron.json') | ConvertFrom-Json
Get-ChildItem -LiteralPath (Join-Path $stage 'cli') -Filter '*.pdb' | Remove-Item
foreach ($dir in @('samples/donors', 'samples/original', 'examples/home-1025m', 'docs', 'licenses')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $stage $dir) | Out-Null
}
Copy-Item -LiteralPath (Join-Path $repo 'scripts/ExtronExporter.ps1') -Destination $stage
$cliReadme = Get-Content -Raw -LiteralPath (Join-Path $repo "releases/cli/$cliVersion/README.md")
$cliReadme.Replace("figma-extron-complete-$cliVersion-local.zip", "figma-extron-complete-$version-local.zip").Replace("CLI для плагина $cliVersion", "CLI для плагина $version").Replace("Комплект для плагина $cliVersion", "Комплект для плагина $version").Replace("заголовок плагина должен показывать **$cliVersion**", "заголовок плагина должен показывать **$version**") | Write-Utf8NoBom (Join-Path $stage 'README.md')
$packagedReadme = Join-Path $stage 'README.md'
[IO.File]::WriteAllText($packagedReadme, [IO.File]::ReadAllText($packagedReadme).Replace('../../../docs/updating-configured-projects.md', 'docs/updating-configured-projects.md'), [Text.UTF8Encoding]::new($false))
foreach ($file in @('donors.json', 'manifest.json')) {
    Copy-Item -LiteralPath (Join-Path $repo "samples/$file") -Destination (Join-Path $stage 'samples')
}
Copy-Item -LiteralPath (Join-Path $repo 'verification/results/2026-10-21-home-layout-1025m/actual-home-layout.exui') -Destination (Join-Path $stage 'examples/home-1025m/home.exui')
Copy-Item -LiteralPath (Join-Path $repo 'verification/results/2026-10-21-home-layout-1025m/id-map.md') -Destination (Join-Path $stage 'examples/home-1025m/id-map.md')
foreach ($file in @('exui-v5.md', 'figma-prefix-reference.md', 'updating-configured-projects.md', 'extron-compatibility.md')) {
    Copy-Item -LiteralPath (Join-Path $repo "docs/$file") -Destination (Join-Path $stage 'docs')
}
Copy-Item -LiteralPath (Join-Path $plugin 'NATIVE_TEXT.md') -Destination (Join-Path $stage 'docs/native-text.md')
Copy-Item -LiteralPath (Join-Path $repo 'docs/prefix_map/figma-extron-prefix-cheatsheet.pdf') -Destination (Join-Path $stage 'docs/figma-extron-prefix-cheatsheet.pdf')
$contractPath = Join-Path $stage 'docs/exui-v5.md'
[IO.File]::WriteAllText($contractPath, [IO.File]::ReadAllText($contractPath).Replace('../src/figma-plugin/NATIVE_TEXT.md', 'native-text.md'), [Text.UTF8Encoding]::new($false))
# Preserve dependency license texts from the exact restored NuGet package.
$packageFolders = (Get-Content -Raw -LiteralPath (Join-Path $repo 'src/extron/obj/project.assets.json') | ConvertFrom-Json).packageFolders.PSObject.Properties.Name
$nrbfPackage = $packageFolders | ForEach-Object { Join-Path $_ 'system.formats.nrbf/10.0.11' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$nrbfPackage) { throw 'Restored System.Formats.Nrbf 10.0.11 package not found' }
Copy-Item -LiteralPath (Join-Path $nrbfPackage 'THIRD-PARTY-NOTICES.TXT') -Destination (Join-Path $stage 'licenses/System.Formats.Nrbf-THIRD-PARTY-NOTICES.txt')
Copy-Item -LiteralPath (Join-Path $nrbfPackage 'system.formats.nrbf.nuspec') -Destination (Join-Path $stage 'licenses/System.Formats.Nrbf.nuspec')
Copy-Item -LiteralPath (Join-Path $repo 'scripts/licenses/System.Formats.Nrbf-LICENSE.txt') -Destination (Join-Path $stage 'licenses')
# Windows PowerShell 5.1 otherwise writes '\' separators into ZIP entry names; archives use '/'.
[AppContext]::SetSwitch('Switch.System.IO.Compression.ZipFile.UseBackslash', $false)
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Assert-ZipEntryNames([string] $Path) {
    $zip = [IO.Compression.ZipFile]::OpenRead($Path)
    try { $bad = @($zip.Entries | Where-Object { $_.FullName.Contains('\') }); if ($bad.Count) { throw "$Path has '\' in entry name $($bad[0].FullName)" } } finally { $zip.Dispose() }
}
@{ version = $cliVersion; compatiblePluginVersion = $version; runtime = 'Microsoft.NETCore.App 10.0 (x64)'; guiDesignerVersions = @($compatibility.profiles.guiDesignerVersion); compatibilityFile = 'cli/compatibility/extron.json'; sourceCommit = $sourceCommit; sourceDirty = $sourceDirty; includesLocalSamples = $false } | ConvertTo-Json | Write-Utf8NoBom (Join-Path $stage 'version.json')
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $cliZip)
Assert-ZipEntryNames $pluginZip
Assert-ZipEntryNames $cliZip

if ($IncludeLocalSamples) {
    # Private samples are only copied to ignored output, never to a tracked release directory.
    $ignoredRoot = [IO.Path]::GetFullPath((Join-Path $repo 'output')) + [IO.Path]::DirectorySeparatorChar
    if (!$OutputDirectory.StartsWith($ignoredRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Local samples may only be packaged under the ignored output directory' }
    $registry = Get-Content -Raw -LiteralPath (Join-Path $repo 'samples/donors.json') | ConvertFrom-Json
    foreach ($donor in $registry.donors) {
        $source = Join-Path $repo "samples/$($donor.file)"
        if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $donor.sha256) { throw "Donor hash mismatch: $($donor.id)" }
        Copy-Item -LiteralPath $source -Destination (Join-Path $stage "samples/$($donor.file)")
    }
    New-Item -ItemType Directory -Path (Join-Path $stage 'figma-plugin') | Out-Null
    [IO.Compression.ZipFile]::ExtractToDirectory($pluginZip, (Join-Path $stage 'figma-plugin'))
    Copy-Item -LiteralPath (Join-Path $repo 'output/home-layout-20261020/home-layout-gui.gdl') -Destination (Join-Path $stage 'examples/home-1025m/home-gui-built.gdl')
    @{ version = $version; cliVersion = $cliVersion; runtime = 'Microsoft.NETCore.App 10.0 (x64)'; guiDesignerVersions = @($compatibility.profiles.guiDesignerVersion); compatibilityFile = 'cli/compatibility/extron.json'; sourceCommit = $sourceCommit; sourceDirty = $sourceDirty; includesLocalSamples = $true } | ConvertTo-Json | Write-Utf8NoBom (Join-Path $stage 'version.json')
    [IO.Compression.ZipFile]::CreateFromDirectory($stage, $localZip)
    Assert-ZipEntryNames $localZip
}
Get-FileHash -Algorithm SHA256 -LiteralPath $pluginZip, $cliZip | Format-Table -AutoSize
if ($IncludeLocalSamples) { Get-FileHash -Algorithm SHA256 -LiteralPath $localZip | Format-Table -AutoSize }
Write-Output "Staged release: $stage"
