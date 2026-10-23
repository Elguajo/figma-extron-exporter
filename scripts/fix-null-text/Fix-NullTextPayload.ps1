param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$Out)
# Give passive controls (PBImage, PBLine, PBShape, PBSlider) an empty Text instead of null,
# for GDLs made before f21bd48. Same technique as src/adapter/host/ExtronAdapterHost.ps1:
# GUI Designer's own types, BinaryFormatter, serialized backing fields only. Never overwrites.
# Run in 32-bit Windows PowerShell 5.1. FIX_NOOP=1 re-serializes without changes (control run).
$ErrorActionPreference = 'Stop'
if ([IntPtr]::Size -ne 4) { throw 'Run in 32-bit Windows PowerShell (SysWOW64).' }
$dir = 'C:\Program Files (x86)\Extron\GUI Designer'
$assemblies = @{}
foreach ($f in @(Get-ChildItem -LiteralPath $dir -Filter *.dll) + @(Get-Item -LiteralPath (Join-Path $dir 'GUI Designer.exe'))) {
    try { $a = [Reflection.Assembly]::LoadFrom($f.FullName); $assemblies[$a.GetName().Name] = $a } catch { }
}
$script:A = $assemblies
[AppDomain]::CurrentDomain.add_AssemblyResolve([ResolveEventHandler] {
    param($s, $e)
    $n = $e.Name.Split(',')[0]
    if ($script:A.ContainsKey($n)) { return $script:A[$n] }
    return $null
})
function Field($o, [string]$name) {
    $t = $o.GetType()
    while ($t -and $t.FullName -ne 'System.Object') {
        $f = $t.GetField($name, 'Instance,Public,NonPublic,DeclaredOnly'); if ($f) { return $f }
        $t = $t.BaseType
    }
    throw "No field $name on $($o.GetType().Name)"
}
$bf = New-Object Runtime.Serialization.Formatters.Binary.BinaryFormatter
$project = $bf.Deserialize((New-Object IO.MemoryStream(, [IO.File]::ReadAllBytes($In))))
if ($project.GetType().FullName -ne 'Extron.GUICPro.PBProject') { throw "Root is $($project.GetType().FullName)" }
"GUI Designer build of payload: " + (Field $project 'applicationBuildVersionInfoField').GetValue($project)
$kinds = if ($env:FIX_NOOP) { @() } else { 'PBImage', 'PBLine', 'PBShape', 'PBSlider' }
$fixed = 0
foreach ($listName in 'pagesField', 'popupPagesField') {
    foreach ($container in (Field $project $listName).GetValue($project)) {
        $cname = (Field $container 'nameField').GetValue($container)
        foreach ($c in (Field $container 'controlsField').GetValue($container)) {
            if ($kinds -notcontains $c.GetType().Name) { continue }
            $tf = Field $c 'textField'
            if ($null -ne $tf.GetValue($c)) { continue }
            $tf.SetValue($c, '')
            if ($tf.GetValue($c) -ne '') { throw 'write did not read back' }
            $fixed++
            "  fixed  $cname / $($c.GetType().Name) $((Field $c 'nameField').GetValue($c))"
        }
    }
}
"fixed controls: $fixed"
$ms = New-Object IO.MemoryStream
$bf.Serialize($ms, $project)
$fs = New-Object IO.FileStream($Out, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try { $fs.Write($ms.ToArray(), 0, [int]$ms.Length) } finally { $fs.Close() }
"payload bytes: $($ms.Length)"
