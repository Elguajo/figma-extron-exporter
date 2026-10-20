<#
    Experimental adapter host: applies a normalized request to ONE allow-listed
    ProjectGCP payload using the GUI Designer assemblies of the local install.

    Started only by ExtronExporter.Adapter (src/adapter) as a separate process:
      C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -NonInteractive
          -ExecutionPolicy Bypass -File ExtronAdapterHost.ps1 -Request <request.json>

    Why this shape (technique credited to rob-paprocki/extron-gdl-toolkit @4390741,
    re-implemented here and checked on our install):
      * Extron's assemblies are x86 .NET Framework; BinaryFormatter is needed to
        materialize the graph. Neither belongs in our .NET 10 process.
      * Objects are cloned from the donor and their serialized backing fields are
        written by reflection. Constructors and property setters reach for editor
        services that do not exist headless.
      * PlatformProTypeEnum retargets go through Extron's own factory
        PBPlatformPro.CreatePlatform, never Activator.

    Safety boundary: the caller (C#) checks the donor against samples/donors.json
    or samples/manifest.json; this script re-checks the payload SHA-256 before it
    deserializes anything, writes only the requested new files in the work folder
    and never starts GUI Designer or Build.

    Result: <work>\result.json { ok, code, message, ... }. Exit 0 ok, 3 refused.
#>
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Request)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$script:Result = [ordered]@{ ok = $false; code = 'internal'; message = ''; warnings = @() }
$script:ResultPath = $null

class AdapterError : System.Exception {
    [string]$Code
    AdapterError([string]$code, [string]$message) : base($message) { $this.Code = $code }
}
function Fail([string]$Code, [string]$Message) { throw [AdapterError]::new($Code, $Message) }
function Warn([string]$Message) { $script:Result.warnings += $Message }

function Write-Result {
    if (-not $script:ResultPath) { return }
    $json = $script:Result | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText($script:ResultPath, $json, (New-Object Text.UTF8Encoding($false)))
}

# --- environment --------------------------------------------------------------

$script:Assemblies = @{}
$script:Formatter = $null

function Initialize-Extron([string]$InstallDir, [string]$ExpectedVersion) {
    if ([IntPtr]::Size -ne 4) { Fail 'host-not-x86' 'Adapter host must run in 32-bit Windows PowerShell (SysWOW64).' }
    if ($PSVersionTable.PSVersion.Major -ne 5) { Fail 'host-not-ps51' "Adapter host requires Windows PowerShell 5.1, got $($PSVersionTable.PSVersion)." }
    $exe = Join-Path $InstallDir 'GUI Designer.exe'
    if (-not (Test-Path -LiteralPath $exe)) { Fail 'extron-missing' "GUI Designer.exe not found in '$InstallDir'. Install GUI Designer $ExpectedVersion." }
    $version = (Get-Item -LiteralPath $exe).VersionInfo.FileVersion
    if ($version -ne $ExpectedVersion) { Fail 'extron-version' "GUI Designer $version is installed; this adapter is verified only with $ExpectedVersion." }
    $files = @(Get-ChildItem -LiteralPath $InstallDir -Filter *.dll) + @(Get-Item -LiteralPath $exe)
    foreach ($f in $files) {
        # Mixed/native DLLs fail to load and none of them is needed for the data graph.
        try { $a = [Reflection.Assembly]::LoadFrom($f.FullName); $script:Assemblies[$a.GetName().Name] = $a } catch { }
    }
    foreach ($name in 'GUI Designer', 'Extron.GUICPro.Layout.Contracts') {
        if (-not $script:Assemblies.ContainsKey($name)) { Fail 'extron-missing' "Extron component '$name' could not be loaded from '$InstallDir'." }
    }
    # Lookup only: LoadFrom inside the handler recurses.
    [AppDomain]::CurrentDomain.add_AssemblyResolve([ResolveEventHandler] {
        param($s, $e)
        $n = $e.Name.Split(',')[0]
        if ($script:Assemblies.ContainsKey($n)) { return $script:Assemblies[$n] }
        return $null
    })
    $script:Formatter = New-Object Runtime.Serialization.Formatters.Binary.BinaryFormatter
    $script:Result.extron = [ordered]@{ installDir = $InstallDir; guiDesignerVersion = $version; assemblies = $script:Assemblies.Count }
}

function Get-ExtronType([string]$FullName) {
    foreach ($a in $script:Assemblies.Values) { $t = $a.GetType($FullName); if ($t) { return $t } }
    Fail 'extron-missing' "Extron type '$FullName' is not available in this install."
}

function Read-Payload([string]$Path, [string]$Sha256) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    $hash = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-', '')
    if ($hash -ne $Sha256.ToUpperInvariant()) { Fail 'donor-hash' 'Payload SHA-256 differs from the allow-listed donor; refusing to deserialize.' }
    $ms = New-Object IO.MemoryStream(, $bytes)
    $project = $script:Formatter.Deserialize($ms)
    if ($project.GetType().FullName -ne 'Extron.GUICPro.PBProject') { Fail 'donor-unsuitable' "Payload root is $($project.GetType().FullName), expected PBProject." }
    return $project
}

function Save-Payload($Project, [string]$Path) {
    if (Test-Path -LiteralPath $Path) { Fail 'output-exists' "Refusing to overwrite '$Path'." }
    $ms = New-Object IO.MemoryStream
    $script:Formatter.Serialize($ms, $Project)
    $fs = New-Object IO.FileStream($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try { $fs.Write($ms.ToArray(), 0, [int]$ms.Length) } finally { $fs.Close() }
    return $ms.Length
}

# --- reflection on serialized backing fields ---------------------------------

function Find-Field($Object, [string]$Name) {
    $t = $Object.GetType()
    while ($t -and $t.FullName -ne 'System.Object') {
        $f = $t.GetField($Name, 'Instance,Public,NonPublic,DeclaredOnly')
        if ($f) { return $f }
        $t = $t.BaseType
    }
    return $null
}

function Get-F($Object, [string]$Name) {
    $f = Find-Field $Object $Name
    if (-not $f) { Fail 'field-missing' "No serialized field '$Name' on $($Object.GetType().Name). $((Get-PSCallStack | Select-Object -First 5 | ForEach-Object { $_.FunctionName + ':' + $_.ScriptLineNumber }) -join ', ')" }
    # Comma keeps a one-element List<T> from being unrolled.
    return , $f.GetValue($Object)
}

function Set-F($Object, [string]$Name, $Value) {
    $f = Find-Field $Object $Name
    if (-not $f) { Fail 'field-missing' "No serialized field '$Name' on $($Object.GetType().Name)." }
    if ($f.IsNotSerialized) { Fail 'field-missing' "Field '$Name' on $($Object.GetType().Name) is not serialized." }
    $v = $Value
    if ($null -ne $v -and $f.FieldType -ne $v.GetType()) {
        if ($f.FieldType.IsEnum) { $v = if ($v -is [string]) { [Enum]::Parse($f.FieldType, $v) } else { [Enum]::ToObject($f.FieldType, $v) } }
        elseif ($f.FieldType.IsValueType -or $f.FieldType -eq [string]) { $v = [Convert]::ChangeType($v, $f.FieldType, [Globalization.CultureInfo]::InvariantCulture) }
    }
    $f.SetValue($Object, $v)
    # Read back: setters are never used, but a conversion surprise must not pass silently.
    $back = $f.GetValue($Object)
    if (($null -eq $v) -ne ($null -eq $back) -or ($null -ne $v -and $f.FieldType.IsValueType -and -not $back.Equals($v))) {
        Fail 'field-write' "Write to $($Object.GetType().Name).$Name did not read back."
    }
}

function Copy-Graph($Object) {
    $ms = New-Object IO.MemoryStream
    $script:Formatter.Serialize($ms, $Object)
    $ms.Position = 0
    return , $script:Formatter.Deserialize($ms)
}

function Get-States($Control) {
    # PBStates is a wrapper; .Count on it reads 1 in PS 5.1 for any button. Use mItems.
    $sts = Get-F $Control 'statesField'
    if ($null -eq $sts) { return , @() }
    $items = Get-F $sts 'mItems'
    if ($null -eq $items) { return , @() }
    return , $items
}

# --- donor lookups ------------------------------------------------------------

# Enumerate a list's elements into the pipeline (functions return lists with a comma).
function Items($List) { if ($null -ne $List) { foreach ($x in $List) { $x } } }
function Get-Pages($Project) { return , (Get-F $Project 'pagesField') }
function Get-Popups($Project) { return , (Get-F $Project 'popupPagesField') }
function Get-Resources($Project) { return , (Get-F (Get-F $Project 'resourceSetField') 'resourcesField') }

function Find-DonorControl($Project, $Ref, [string]$Kind) {
    $page = @(Items (Get-Pages $Project) | Where-Object { (Get-F $_ 'nameField') -eq $Ref.page })
    if ($page.Count -ne 1) { Fail 'donor-element' "Donor page '$($Ref.page)' for $Kind not found exactly once." }
    $hits = @(Items (Get-F $page[0] 'controlsField') | Where-Object { [int](Get-F $_ 'userIdField') -eq [int]$Ref.controlId -and $_.GetType().Name -eq $Ref.type })
    if ($hits.Count -ne 1) { Fail 'donor-element' "Donor $($Ref.type) with control ID $($Ref.controlId) on page '$($Ref.page)' for $Kind not found exactly once." }
    return , $hits[0]
}

function Find-ImageReference($Project) {
    foreach ($pg in @(Items (Get-Pages $Project)) + @(Items (Get-Popups $Project))) {
        $v = Get-F $pg 'backgroundImageField'; if ($v) { return , $v }
        foreach ($c in (Get-F $pg 'controlsField')) {
            foreach ($st in (Get-States $c)) { $v = Get-F $st 'buttonImageField'; if ($v) { return , $v } }
        }
    }
    Fail 'resource-missing' 'Donor has no PBResourceReferenceImage to clone.'
}

function Find-ColorDonor($Project) {
    foreach ($pg in (Get-Pages $Project)) {
        foreach ($c in (Get-F $pg 'controlsField')) {
            foreach ($st in (Get-States $c)) { $v = Get-F $st 'borderFillColorField'; if ($v) { return , $v } }
        }
    }
    Fail 'resource-missing' 'Donor has no PBColor to clone.'
}

function Set-Color($Project, $Target, [string]$Field, [string]$Hex) {
    if (-not $Hex) { return }
    if ($Hex -notmatch '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$') { Fail 'spec' "Bad color '$Hex'." }
    $h = $Hex.Substring(1); if ($h.Length -eq 6) { $h = 'FF' + $h }
    $argb = [Convert]::ToUInt32($h, 16)
    $existing = Get-F $Target $Field
    if (-not $existing) { $existing = Find-ColorDonor $Project }
    $c = Copy-Graph $existing
    $color = [Drawing.Color]::FromArgb([int](($argb -shr 24) -band 0xFF), [int](($argb -shr 16) -band 0xFF), [int](($argb -shr 8) -band 0xFF), [int]($argb -band 0xFF))
    Set-F $c 'valueField' $color
    # >= 0 would draw a palette entry and ignore the value.
    Set-F $c 'paletteIndexField' -1
    Set-F $Target $Field $c
}

function Set-Font($Project, $Target, $Font) {
    if ($null -eq $Font) { return }
    $existing = Get-F $Target 'fontField'
    if (-not $existing) { Fail 'donor-element' "$($Target.GetType().Name) has no font to clone." }
    $f = Copy-Graph $existing
    if ($Font.family) {
        $resources = @(Items (Get-Resources $Project) | Where-Object { $_.GetType().Name -eq 'PBFontResource' })
        $match = @($resources | Where-Object { ((Get-F $_ 'nameField') -replace '(\s+(Regular|Bold|Italic))+$', '') -ieq $Font.family })
        if ($match.Count -lt 1) {
            $have = ($resources | ForEach-Object { Get-F $_ 'nameField' }) -join ', '
            Fail 'resource-missing' "Font family '$($Font.family)' has no PBFontResource in the donor (has: $have)."
        }
        Set-F $f 'nameField' $Font.family
        $ref = Get-F $f 'fontResourceReferenceField'
        if (-not $ref) { Fail 'donor-element' 'Donor font has no resource reference to retarget.' }
        $r = Copy-Graph $ref
        Set-F $r 'resourceNameField' (Get-F $match[0] 'nameField')
        Set-F $f 'fontResourceReferenceField' $r
    }
    if ($null -ne $Font.size) { Set-F $f 'pointSizeField' ([single]$Font.size) }
    if ($null -ne $Font.bold) {
        $style = Copy-Graph (Get-F $f 'styleField')
        Set-F $style 'boldField' ([bool]$Font.bold)
        Set-F $f 'styleField' $style
    }
    Set-F $Target 'fontField' $f
}

function Add-ImageResource($Project, $Image) {
    $resources = Get-Resources $Project
    $images = @(Items $resources | Where-Object { $_.GetType().Name -eq 'PBImageResource' })
    if (-not $images.Count) { Fail 'resource-missing' 'Donor has no PBImageResource to clone.' }
    if (@($images | Where-Object { (Get-F $_ 'nameField') -eq $Image.resourceName }).Count) {
        Fail 'resource-conflict' "Donor already has an image resource named '$($Image.resourceName)'."
    }
    if (-not (Test-Path -LiteralPath $Image.file)) { Fail 'resource-missing' "Image file '$($Image.file)' not found." }
    Add-Type -AssemblyName System.Drawing
    $bytes = [IO.File]::ReadAllBytes($Image.file)
    $ms = New-Object IO.MemoryStream(, $bytes)
    $decoded = [Drawing.Image]::FromStream($ms)
    # Detached copy so the bitmap no longer depends on the stream.
    $bmp = New-Object Drawing.Bitmap($decoded)
    $decoded.Dispose()
    if ($bmp.Width -ne [int]$Image.width -or $bmp.Height -ne [int]$Image.height) { Fail 'resource-mismatch' "Image '$($Image.resourceName)' is $($bmp.Width)x$($bmp.Height), spec says $($Image.width)x$($Image.height)." }
    $new = Copy-Graph $images[0]
    Set-F $new 'nameField' $Image.resourceName
    Set-F $new 'filenameField' ([IO.Path]::GetFileName($Image.file))
    Set-F $new 'dataField' $bmp
    Set-F $new 'widthField' $bmp.Width
    Set-F $new 'heightField' $bmp.Height
    Set-F $new 'sizeField' $bytes.Length
    $resources.Add($new)
}

function Set-ImageRef($Target, [string]$Field, $RefDonor, [string]$ResourceName) {
    if (-not $ResourceName) { Set-F $Target $Field $null; return }
    $r = Copy-Graph $RefDonor
    Set-F $r 'resourceNameField' $ResourceName
    Set-F $Target $Field $r
}

function Resize-States($Control, [int]$Count) {
    $sts = Get-F $Control 'statesField'
    $items = Get-F $sts 'mItems'
    if ($null -eq $items -or $items.Count -lt 1) { Fail 'donor-element' "Donor $($Control.GetType().Name) has no state to clone." }
    if ((Get-F $sts 'statusField') -and $items.Count -ne $Count) { Fail 'donor-element' 'Donor button forbids adding/removing states.' }
    while ($items.Count -lt $Count) { $items.Add((Copy-Graph $items[$items.Count - 1])) }
    while ($items.Count -gt $Count) { $items.RemoveAt($items.Count - 1) }
    for ($i = 0; $i -lt $items.Count; $i++) { Set-F $items[$i] 'idField' ([uint64]$i); Set-F $items[$i] 'indexField' $i }
    return , $items
}

# --- operations -----------------------------------------------------------------

function Set-Platform($Project, [string]$Type) {
    $enumType = Get-ExtronType 'Extron.GUICPro.Layout.Contracts.Enumerations.PlatformProTypeEnum'
    $factory = (Get-ExtronType 'Extron.GUICPro.PBPlatformPro').GetMethod('CreatePlatform')
    if (-not $factory) { Fail 'extron-missing' 'PBPlatformPro.CreatePlatform is not available.' }
    $value = [Enum]::Parse($enumType, $Type)
    $platform = $factory.Invoke($null, @($Project, $value))
    Set-F $Project 'platformField' $platform
    Set-F $Project 'platformTypeField' $value
    $w = [int](Get-F $platform 'horizontalResolutionField'); $h = [int](Get-F $platform 'verticalResolutionField')
    Set-F $Project 'screenSizeField' (New-Object Drawing.Size($w, $h))
    return @($w, $h)
}

function Get-Profile($Project) {
    $platform = Get-F $Project 'platformField'
    $size = Get-F $Project 'screenSizeField'
    return [ordered]@{
        platformClass = $platform.GetType().Name
        platformType = [string](Get-F $Project 'platformTypeField')
        platformTypeValue = [int](Get-F $Project 'platformTypeField')
        partNumber = [string](Get-F $platform 'partNumberField')
        width = $size.Width; height = $size.Height
    }
}

function Scale-Container($Container, [double]$Scale, [int]$Dx, [int]$Dy) {
    foreach ($c in (Get-F $Container 'controlsField')) {
        Set-F $c 'leftField' ([int][Math]::Round((Get-F $c 'leftField') * $Scale) + $Dx)
        Set-F $c 'topField' ([int][Math]::Round((Get-F $c 'topField') * $Scale) + $Dy)
        Set-F $c 'widthField' ([int][Math]::Max(1, [Math]::Round((Get-F $c 'widthField') * $Scale)))
        Set-F $c 'heightField' ([int][Math]::Max(1, [Math]::Round((Get-F $c 'heightField') * $Scale)))
    }
}

function Invoke-PrepareDonor($Project, $Op) {
    $before = Get-Profile $Project
    $pages = Get-Pages $Project
    $keepPages = @($Op.keepPages)
    foreach ($name in $keepPages) { if (@(Items $pages | Where-Object { (Get-F $_ 'nameField') -eq $name }).Count -ne 1) { Fail 'donor-unsuitable' "Source page '$name' not found exactly once." } }
    for ($i = $pages.Count - 1; $i -ge 0; $i--) { if ($keepPages -notcontains (Get-F $pages[$i] 'nameField')) { $pages.RemoveAt($i) } }
    $popups = Get-Popups $Project
    $keepPopups = @($Op.keepPopupIds | ForEach-Object { [uint64]$_ })
    foreach ($id in $keepPopups) { if (@(Items $popups | Where-Object { [uint64](Get-F $_ 'idField') -eq $id }).Count -ne 1) { Fail 'donor-unsuitable' "Source popup $id not found exactly once." } }
    for ($i = $popups.Count - 1; $i -ge 0; $i--) { if ($keepPopups -notcontains [uint64](Get-F $popups[$i] 'idField')) { $popups.RemoveAt($i) } }
    $pageIds = @(Items $pages | ForEach-Object { [uint64](Get-F $_ 'idField') })
    foreach ($pu in $popups) {
        # Back-pointers must name controls on kept pages; anything else would dangle.
        foreach ($r in (Get-F $pu 'popupReferencesField')) {
            if ([uint64](Get-F $r 'popupPageIDField') -ne [uint64]::MaxValue -or $pageIds -notcontains [uint64](Get-F $r 'pageIDField')) {
                Fail 'donor-unsuitable' "Kept popup '$(Get-F $pu 'nameField')' is referenced from a removed page or popup."
            }
        }
    }
    if ($Op.retarget) {
        $oldW = $before.width; $oldH = $before.height
        $size = Set-Platform $Project $Op.retarget
        # Uniform scale. Full-canvas containers are centered; a smaller popup keeps its authored size
        # ratio and scales with its own contents (its placement comes from its reference control).
        # [double]: 1280/320 is Int32 in PowerShell, and Math.Min(int, double) would then round 1.667 to 2.
        $scale = [Math]::Min([double]$size[0] / $oldW, [double]$size[1] / $oldH)
        $dx = [int](($size[0] - $oldW * $scale) / 2); $dy = [int](($size[1] - $oldH * $scale) / 2)
        foreach ($pg in @(Items (Get-Pages $Project)) + @(Items (Get-Popups $Project))) {
            $w = [int](Get-F $pg 'widthField'); $h = [int](Get-F $pg 'heightField')
            if ($w -eq $oldW -and $h -eq $oldH) {
                Set-F $pg 'widthField' $size[0]; Set-F $pg 'heightField' $size[1]
                Scale-Container $pg $scale $dx $dy
            } elseif ($pg.GetType().Name -eq 'PBPopupPage' -and $w -le $oldW -and $h -le $oldH) {
                Set-F $pg 'widthField' ([int][Math]::Round($w * $scale)); Set-F $pg 'heightField' ([int][Math]::Round($h * $scale))
                Scale-Container $pg $scale 0 0
            } else {
                Fail 'donor-unsuitable' "Container '$(Get-F $pg 'nameField')' has no retarget size rule."
            }
        }
    }
    if ($Op.projectName) { Set-F $Project 'nameField' $Op.projectName }
    $first = @(Items (Get-Pages $Project))[0]
    Set-F $Project 'defaultPageField' ([uint16](Get-F $first 'idField'))
    $script:Result.sourceProfile = $before
    $script:Result.profile = Get-Profile $Project
    $script:Result.pages = @(Items (Get-Pages $Project) | ForEach-Object { Get-F $_ 'nameField' })
    $script:Result.popups = @(Items (Get-Popups $Project) | ForEach-Object { Get-F $_ 'nameField' })
}

function New-Control($Project, $Donor, $El) {
    $c = Copy-Graph $Donor
    Set-F $c 'idField' ([uint64]$El.objectId)
    Set-F $c 'userIdField' ([uint16]$El.controlId)
    Set-F $c 'nameField' $El.name
    Set-F $c 'commentsField' ("exui-key=" + $El.key)
    Set-F $c 'leftField' ([int]$El.rect[0]); Set-F $c 'topField' ([int]$El.rect[1])
    Set-F $c 'widthField' ([int]$El.rect[2]); Set-F $c 'heightField' ([int]$El.rect[3])
    Set-F $c '<TLPImageID>k__BackingField' -1
    Set-F $c 'transparencyField' ([single]0)
    Set-F $c 'flattenTextField' $false
    Set-F $c 'ftextField' $null
    Set-F $c 'backgroundImageField' $null
    Set-F $c 'buttonImageField' $null
    return , $c
}

# PBSlider's parameterless data constructor was probed on 1.28.0.7. Copy a
# cloned donor's serialized common base graph, never editor services or input objects.
function New-SliderDonor($Level) {
    $source = Copy-Graph $Level
    $slider = [Activator]::CreateInstance((Get-ExtronType 'Extron.GUICPro.PBSlider'))
    $t = Get-ExtronType 'Extron.GUICPro.PBControl'
    while ($t -and $t -ne [object]) {
        foreach ($f in $t.GetFields('Instance,Public,NonPublic,DeclaredOnly')) {
            if (-not $f.IsNotSerialized) { $f.SetValue($slider, $f.GetValue($source)) }
        }
        $t = $t.BaseType
    }
    Set-F $slider 'typeField' 'Slider'
    foreach ($f in '<TLPMinValueImageID>k__BackingField','<TLPMaxValueImageID>k__BackingField','<SliderIndicatorImageID>k__BackingField') { Set-F $slider $f -1 }
    return , $slider
}

function Set-AuthoredBorder($Project, $Control, $El, [bool]$Slider) {
    $resources = Get-Resources $Project
    $seed = @(Items $resources | Where-Object { $_.GetType().Name -eq 'PBBorderResource' -and (Get-F $_ 'nameField') -eq '2D Rectangle' })
    if ($seed.Count -ne 1) { Fail 'donor-element' 'Pinned donor must contain the 2D Rectangle border resource.' }
    $resource = Copy-Graph $seed[0]
    $name = 'exui-border-' + $El.key
    if (@(Items $resources | Where-Object { (Get-F $_ 'nameField') -eq $name }).Count) { Fail 'resource-collision' "Resource '$name' already exists." }
    Set-F $resource 'nameField' $name
    Set-F $resource 'mIsDefault' $false
    $info = Get-F $resource 'dataField'
    Set-F $info 'typeField' $(if ($Slider -or $El.native.shape -eq 'rectangle') { 'Rectangle' } else { 'Ellipse' })
    Set-F $info 'cornerRadiusField' ([int]$El.native.radius)
    Set-F $info 'thicknessField' $(if ($Slider) { 0 } else { [int]$El.native.thickness })
    Set-F $info 'styleField' 'Item2D'
    Set-F $info 'depthField' 0
    Set-F $info 'surfaceHeightField' 0
    $reference = [Activator]::CreateInstance((Get-ExtronType 'Extron.GUICPro.PBResourceReferenceBorder'))
    Set-F $reference 'resourceNameField' $name
    $resources.Add($resource)
    Set-F $Control 'borderField' $reference
}

function Find-Container($Project, [string]$Field, [string]$Name, [string]$What) {
    $hits = @(Items (Get-F $Project $Field) | Where-Object { (Get-F $_ 'nameField') -eq $Name })
    if ($hits.Count -ne 1) { Fail 'donor-element' "Donor $What '$Name' not found exactly once." }
    return , $hits[0]
}

function New-Container($Project, $Donor, $Spec, [int]$Width, [int]$Height) {
    $c = Copy-Graph $Donor
    Set-F $c 'idField' ([uint64]$Spec.objectId)
    Set-F $c 'userIdField' ([uint16]$Spec.objectId)
    Set-F $c 'nameField' $Spec.name
    Set-F $c 'commentsField' ("exui-key=" + $Spec.key)
    Set-F $c 'widthField' $Width; Set-F $c 'heightField' $Height
    Set-F $c '<TLPImageID>k__BackingField' -1
    Set-F $c 'backgroundImageField' $null
    Set-Color $Project $c 'backgroundFillColorField' $Spec.background
    (Get-F $c 'controlsField').Clear()
    return , $c
}

function Set-PlanStates($Project, $c, $El, $ImageRef) {
            $states = Resize-States $c @($El.states).Count
            for ($i = 0; $i -lt $states.Count; $i++) {
                $s = @($El.states)[$i]; $st = $states[$i]
                Set-F $st 'nameField' $s.name
                Set-F $st 'textField' $s.text
                Set-F $st 'ftextField' $null
                Set-F $st '<TLPImageID>k__BackingField' -1
                Set-F $st 'backgroundImageField' $null
                Set-ImageRef $st 'buttonImageField' $ImageRef $s.image
                if ($s.image) {
                    Set-F $st 'buttonImageLayoutField' 'Native'
                    Set-F $st 'buttonImageAlignmentField' $s.imageAlign
                }
                Set-F $st 'textAlignmentField' $s.textAlign
                Set-Color $Project $st 'borderFillColorField' $s.fill
                Set-Color $Project $st 'textColorField' $s.textColor
                Set-Font $Project $st $El.font
            }
}

# One button, label or level, from a plan element (popup-ref is bound separately).
function New-PlanControl($Project, $Donors, $El, $ImageRef) {
    $c = New-Control $Project $Donors[$El.kind] $El
    switch ($El.kind) {
        'slider' {
            Set-F $c 'textField' $null
            Set-F $c 'orientationField' $El.orientation
            Set-F $c 'minValueField' ([uint32]$El.min)
            Set-F $c 'maxValueField' ([uint32]$El.max)
            Set-F $c 'sliderFillTypeField' 'Color'
            Set-Color $Project $c 'sliderFillColorField' $El.fillColor
            Set-F $c 'sliderThumbTypeField' $(@{ellipse='ClosedEllipse';rectangle='ClosedRectangle';none='None'}[$El.native.thumbType])
            Set-Color $Project $c 'sliderThumbColorField' $El.native.thumbColor
            Set-F $c 'sliderThumbWidth' ([int]$El.native.thumbWidth)
            Set-F $c 'sliderThumbHeight' ([int]$El.native.thumbHeight)
            # GUI Designer 1.28.0.7 computes even a vector thumb's rectangle only
            # when SliderThumbImage resolves to a bitmap. Keep the pinned stock
            # resource as a geometry dependency; Ellipse/Rectangle still draw
            # the authored solid color, not this image.
            if ($El.native.thumbType -ne 'none') {
                $thumbResource = @(Items (Get-Resources $Project) | Where-Object { $_.GetType().Name -eq 'PBImageResource' -and (Get-F $_ 'nameField') -eq 'Slider Thumb' })
                if ($thumbResource.Count -ne 1) { Fail 'resource-missing' 'Pinned donor must contain the Slider Thumb bitmap for native thumb geometry.' }
                Set-ImageRef $c 'sliderThumbImageField' $ImageRef 'Slider Thumb'
            }
            Set-F $c 'sliderTrackWidth' ([int]$El.native.trackWidth)
            Set-F $c 'showSliderTickMarksField' $false
            Set-F $c '<SliderThumbRectFactor>k__BackingField' ([double]$El.native.thumbHeight / [double]$El.native.thumbWidth)
            Set-Color $Project $c 'borderFillColorField' $El.native.trackColor
            Set-Color $Project $c 'borderColorField' '#00000000'
            Set-Color $Project $c 'backgroundFillColorField' '#00000000'
            Set-AuthoredBorder $Project $c $El $true
        }
        'shape' {
            Set-F $c 'textField' $null
            Set-F $c 'dynamicTextField' $false
            Set-Color $Project $c 'backgroundFillColorField' '#00000000'
            Set-Color $Project $c 'borderFillColorField' $El.fillColor
            Set-Color $Project $c 'borderColorField' $El.native.strokeColor
            Set-AuthoredBorder $Project $c $El $false
        }
        'line' {
            Set-F $c 'textField' $null
            Set-F $c 'dynamicTextField' $false
            Set-F $c 'thicknessField' ([int]$El.native.thickness)
            Set-F $c 'startCapField' 'Flat'; Set-F $c 'endCapField' 'Flat'
            Set-F $c 'startPointField' $(if ($El.rect[2] -ge $El.rect[3]) { 'MiddleLeft' } else { 'TopCenter' })
            Set-F $c 'endPointField' $(if ($El.rect[2] -ge $El.rect[3]) { 'MiddleRight' } else { 'BottomCenter' })
            Set-Color $Project $c 'borderFillColorField' $El.fillColor
        }
        'datetime' {
            Set-F $c 'textField' $null
            Set-F $c 'patternField' $El.native.pattern
            Set-F $c 'textAlignmentField' 'MiddleLeft'
            Set-Color $Project $c 'textColorField' $El.textColor
            Set-Font $Project $c $El.font
        }
        'value' {
            Set-F $c 'textField' $El.text
            Set-F $c 'dynamicTextField' $true
            Set-F $c 'textAlignmentField' 'MiddleLeft'
            Set-Color $Project $c 'textColorField' $El.textColor
            Set-Font $Project $c $El.font
        }
        'graphic' {
            Set-F $c 'textField' $null
            Set-F $c 'dynamicTextField' $false
            Set-F $c 'shapeTypeField' 'None'
            Set-Color $Project $c 'backgroundFillColorField' '#00000000'
            Set-Color $Project $c 'borderFillColorField' '#00000000'
            Set-F $c 'backgroundImageKeyColorField' $null
            Set-F $c 'buttonImageKeyColorField' $null
            # PBImage paints via PBControl.UpdateBackgroundImage, unlike button
            # states. Its visible Image property uses the backgroundImage fields.
            Set-ImageRef $c 'backgroundImageField' $ImageRef $El.image
            Set-F $c 'backgroundImageLayoutField' 'Native'
            Set-F $c 'backgroundImageAlignmentField' 'MiddleCenter'
            Set-F $c 'backgroundImageLeftField' 0
            Set-F $c 'backgroundImageTopField' 0
        }
        'label' {
            Set-F $c 'textField' $El.text
            Set-F $c 'textAlignmentField' 'MiddleLeft'
            Set-Color $Project $c 'textColorField' $El.textColor
            Set-Font $Project $c $El.font
        }
        'level' {
            Set-F $c 'displayTypeField' $El.display
            Set-F $c 'orientationField' $El.orientation
            Set-F $c 'minValueField' ([uint32]$El.min)
            Set-F $c 'maxValueField' ([uint32]$El.max)
            Set-Color $Project $c 'gaugeFillColorField' $El.fillColor
            if ($El.states) { Set-F $c 'statesField' (Copy-Graph (Get-F $Donors['button'] 'statesField')); Set-PlanStates $Project $c $El $ImageRef }
        }
        'button' {
            Set-F $c 'textField' $null
            Set-PlanStates $Project $c $El $ImageRef
            Set-F $c '<TLPDefaultStateID>k__BackingField' 0
            Set-F $c '<TLPPressFeedbackStateID>k__BackingField' ([int]$El.pressState)
            Set-F $c '<HidePressFeedback>k__BackingField' $false
            Set-F $c '<HideVisualFeedback>k__BackingField' $false
            Set-F $c '<HideTextFeedback>k__BackingField' $false
        }
        default { Fail 'spec' "Element kind '$($El.kind)' is not supported here." }
    }
    return , $c
}

function Invoke-Generate($Project, $Op) {
    $profile = Get-Profile $Project
    $exp = $Op.expectedProfile
    if ($profile.platformType -ne $exp.platformType -or $profile.partNumber -ne $exp.partNumber -or $profile.width -ne [int]$exp.width -or $profile.height -ne [int]$exp.height) {
        Fail 'profile-mismatch' "Donor profile $($profile.platformType) $($profile.partNumber) $($profile.width)x$($profile.height) differs from expected $($exp.platformType) $($exp.partNumber) $($exp.width)x$($exp.height)."
    }
    $donors = @{}
    foreach ($kind in 'button', 'label', 'level') {
        $ref = $Op.donorElements.$kind
        if ($null -eq $ref) { Fail 'donor-element' "Donor registry gives no element for kind '$kind'." }
        $donors[$kind] = Find-DonorControl $Project $ref $kind
    }
    $donors['value'] = $donors['label']
    $allElements = @(@($Op.pages) + @($Op.popups) | ForEach-Object { @($_.elements) })
    if (@($allElements | Where-Object { $_.kind -eq 'slider' }).Count) { $donors['slider'] = New-SliderDonor $donors['level'] }
    foreach ($kind in 'shape','line','datetime') {
        if (-not @($allElements | Where-Object { $_.kind -eq $kind }).Count) { continue }
        $ref = $Op.donorElements.$kind
        if (-not $ref) { Fail 'donor-element' "Donor registry gives no $kind donor." }
        $containers = @(@(Items (Get-Pages $Project)) + @(Items (Get-Popups $Project)) | Where-Object { (Get-F $_ 'nameField') -eq $ref.page })
        $hits = @($containers | ForEach-Object { Items (Get-F $_ 'controlsField') } | Where-Object { $_.GetType().Name -eq $ref.type -and (Get-F $_ 'nameField') -eq $ref.name })
        if ($hits.Count -ne 1) { Fail 'donor-element' "The pinned $kind donor must be found exactly once." }
        $donors[$kind] = $hits[0]
    }
    $usesGraphics = @($allElements | Where-Object { $_.kind -eq 'graphic' }).Count -gt 0
    if ($usesGraphics) {
        $ref = $Op.donorElements.graphic
        if (-not $ref -or $ref.type -ne 'PBImage') { Fail 'donor-element' 'Donor registry must identify a PBImage for static graphics.' }
        $containers = @(@(Items (Get-Pages $Project)) + @(Items (Get-Popups $Project)) | Where-Object { (Get-F $_ 'nameField') -eq $ref.page })
        $hits = @($containers | ForEach-Object { Items (Get-F $_ 'controlsField') } | Where-Object { $_.GetType().Name -eq 'PBImage' -and (Get-F $_ 'nameField') -eq $ref.name })
        if ($hits.Count -ne 1) { Fail 'donor-element' 'The pinned PBImage donor must be found exactly once.' }
        $donors['graphic'] = $hits[0]
    }
    $donorPage = Find-Container $Project 'pagesField' $Op.donorElements.page.page 'page'
    $planPopups = @($Op.popups)
    $usesRefs = @(@($Op.pages) | ForEach-Object { @($_.elements) } | Where-Object { $_.kind -eq 'popup-ref' }).Count -gt 0
    $donorStd = $null; $donorModal = $null; $backDonor = $null
    if ($planPopups.Count -or $usesRefs) {
        foreach ($k in 'popupReference', 'standardPopup', 'modalPopup') {
            if ($null -eq $Op.donorElements.$k) { Fail 'donor-element' "Donor registry gives no '$k'; this donor cannot author popups." }
        }
        $refPage = Find-Container $Project 'pagesField' $Op.donorElements.popupReference.page 'page'
        $refHits = @(Items (Get-F $refPage 'controlsField') | Where-Object { $_.GetType().Name -eq 'PBPopupPageReference' -and (Get-F $_ 'nameField') -eq $Op.donorElements.popupReference.name })
        if ($refHits.Count -ne 1) { Fail 'donor-element' "Donor popup reference '$($Op.donorElements.popupReference.name)' not found exactly once." }
        $donors['popup-ref'] = $refHits[0]
        $donorStd = Find-Container $Project 'popupPagesField' $Op.donorElements.standardPopup.name 'standard popup'
        $donorModal = Find-Container $Project 'popupPagesField' $Op.donorElements.modalPopup.name 'modal popup'
        if ([bool](Get-F $donorStd 'modalField') -or -not [bool](Get-F $donorModal 'modalField')) { Fail 'donor-element' 'Donor standard/modal popup roles are swapped.' }
        $backDonor = @(Items (Get-F $donorStd 'popupReferencesField'))[0]
        if (-not $backDonor) { Fail 'donor-element' 'Donor standard popup has no back-reference to clone.' }
    }

    foreach ($im in @($Op.images)) { Add-ImageResource $Project $im }
    $imageRef = Find-ImageReference $Project
    $projectId = [string](Get-F $Project 'idField')
    $NONE = [uint64]::MaxValue

    # Popup group registry: rebuilt from the plan. There is no donor PBControlGroup to clone; it is a plain
    # serializable data object whose (name, id) constructor touches no editor service.
    $groups = Get-F $Project 'popupPageGroupsField'
    # List<T>.Clear bumps the serialized _version even when empty; touch the list only when needed.
    if ($groups.Count) { $groups.Clear() }
    $groupIds = @{}
    $groupIndex = 0
    foreach ($g in @($Op.groups)) {
        $groupType = Get-ExtronType 'Extron.GUICPro.PBControlGroup'
        $grp = $groupType.GetConstructor([type[]]@([string], [uint16])).Invoke(@([string]$g.name, [uint16]$g.groupId))
        Set-F $grp 'indexField' $groupIndex; $groupIndex++
        Set-F $grp 'referenceCountField' ([int]$g.referenceCount)
        $groups.Add($grp)
        $groupIds[$g.key] = [uint16]$g.groupId
    }

    # Only the donor's Offline page survives; donor popups used as clone sources are removed.
    $popups = Get-Popups $Project
    for ($i = $popups.Count - 1; $i -ge 0; $i--) { if ([uint64](Get-F $popups[$i] 'idField') -ne 65535) { $popups.RemoveAt($i) } }
    $made = @{}
    foreach ($pu in $planPopups) {
        $donor = if ($pu.modal) { $donorModal } else { $donorStd }
        $p = New-Container $Project $donor $pu ([int]$pu.width) ([int]$pu.height)
        Set-F $p 'modalField' ([bool]$pu.modal)
        $backs = Get-F $p 'popupReferencesField'
        if ($backs.Count) { $backs.Clear() }
        Set-F $p 'hasReferencesField' $false
        if ($pu.group) {
            $gname = @(@($Op.groups) | Where-Object { $_.key -eq $pu.group })[0].name
            Set-F $p 'groupIDField' $groupIds[$pu.group]; Set-F $p 'groupNameField' $gname
        } else {
            Set-F $p 'groupIDField' ([uint16]0); Set-F $p 'groupNameField' $null
        }
        foreach ($el in @($pu.elements)) { (Get-F $p 'controlsField').Add((New-PlanControl $Project $donors $el $imageRef)) }
        $popups.Add($p)
        $made[$pu.key] = $p
    }

    $newPages = @()
    foreach ($pg in @($Op.pages)) {
        $page = New-Container $Project $donorPage $pg $profile.width $profile.height
        $controls = Get-F $page 'controlsField'
        foreach ($el in @($pg.elements)) {
            if ($el.kind -ne 'popup-ref') { $controls.Add((New-PlanControl $Project $donors $el $imageRef)); continue }
            # A popup binding lives in four places: this control's PBPopupPageID, the popup's group fields,
            # the popup's back-references and the project's group registry. All are written here.
            $c = New-Control $Project $donors['popup-ref'] $el
            Set-F $c 'modalField' $false
            $bind = Copy-Graph (Get-F $c 'popupPageIDField')
            if ($el.group) {
                $gname = @(@($Op.groups) | Where-Object { $_.key -eq $el.group })[0].name
                Set-F $bind 'popupIDField' $NONE; Set-F $bind 'groupIDField' $groupIds[$el.group]
                Set-F $bind 'popupNameField' ''; Set-F $bind 'groupNameField' $gname
                $targets = @($planPopups | Where-Object { $_.group -eq $el.group } | ForEach-Object { $made[$_.key] })
            } else {
                $t = $made[$el.popup]
                if ($null -eq $t) { Fail 'spec' "Popup '$($el.popup)' is not in the plan." }
                Set-F $bind 'popupIDField' ([uint64](Get-F $t 'idField')); Set-F $bind 'groupIDField' ([uint16]0)
                Set-F $bind 'popupNameField' (Get-F $t 'nameField'); Set-F $bind 'groupNameField' $null
                $targets = @($t)
            }
            Set-F $c 'popupPageIDField' $bind
            foreach ($t in $targets) {
                $b = Copy-Graph $backDonor
                Set-F $b 'projectIDField' $projectId
                Set-F $b 'pageIDField' ([uint64]$pg.objectId)
                Set-F $b 'popupPageIDField' $NONE
                Set-F $b 'objectIDField' ([uint64]$el.objectId)
                (Get-F $t 'popupReferencesField').Add($b)
                Set-F $t 'hasReferencesField' $true
            }
            $controls.Add($c)
        }
        $newPages += $page
    }

    # The generated project holds only the generated pages; donor pages are removed.
    $pages = Get-Pages $Project
    $pages.Clear()
    foreach ($page in $newPages) { $pages.Add($page) }
    $start = @(@($Op.pages) | Where-Object { $_.key -eq $Op.startPage })
    if ($start.Count -ne 1) { Fail 'spec' "Start page '$($Op.startPage)' is not in the plan." }
    Set-F $Project 'defaultPageField' ([uint16]$start[0].objectId)
    if ($Op.projectName) { Set-F $Project 'nameField' $Op.projectName }
    Set-F $Project 'buildStatusField' 'Needed'

    $script:Result.profile = Get-Profile $Project
    $script:Result.containers = @(@(Items $pages) + @(Items $popups) | ForEach-Object {
        [ordered]@{ type = $_.GetType().Name; objectId = [string](Get-F $_ 'idField'); name = Get-F $_ 'nameField'; controls = (Get-F $_ 'controlsField').Count }
    })
    $script:Result.groups = @(Items $groups | ForEach-Object { [ordered]@{ id = [int](Get-F $_ 'idField'); name = Get-F $_ 'nameField' } })
}

# The C# side reads enums as numbers (NRBF); report Extron's own name -> number mapping.
function Get-EnumValues($Project) {
    $map = { param($t) $o = [ordered]@{}; foreach ($n in [Enum]::GetNames($t)) { $o[$n] = [int][Enum]::Parse($t, $n) }; $o }
    return [ordered]@{
        platformType = [int](Get-F $Project 'platformTypeField')
        levelDisplay = & $map (Get-ExtronType 'Extron.GUICPro.Layout.Contracts.Enumerations.LevelDisplayTypeEnum')
        levelOrientation = & $map (Get-ExtronType 'Extron.GUICPro.Layout.Contracts.Enumerations.LevelOrientationEnum')
    }
}

# --- main ---------------------------------------------------------------------------

$exit = 3
try {
    $req = [IO.File]::ReadAllText($Request, [Text.Encoding]::UTF8) | ConvertFrom-Json
    $script:ResultPath = $req.resultPath
    if ($req.protocol -ne 'extron-adapter/1') { Fail 'protocol' "Unknown request protocol '$($req.protocol)'." }
    Initialize-Extron $req.installDir $req.guiDesignerVersion
    $project = Read-Payload $req.payloadPath $req.payloadSha256
    $app = [string](Get-F $project 'applicationBuildVersionInfoField')
    if ($app -ne $req.guiDesignerVersion) { Fail 'donor-unsuitable' "Donor was saved by GUI Designer $app; expected $($req.guiDesignerVersion)." }
    switch ($req.operation) {
        'prepare-donor' { Invoke-PrepareDonor $project $req.prepare }
        'generate' { Invoke-Generate $project $req.generate }
        default { Fail 'protocol' "Unknown operation '$($req.operation)'." }
    }
    $script:Result.enumValues = Get-EnumValues $project
    $script:Result.outputBytes = Save-Payload $project $req.outputPath
    $script:Result.ok = $true; $script:Result.code = 'ok'; $script:Result.message = 'written'
    $exit = 0
} catch [AdapterError] {
    $script:Result.code = $_.Exception.Code; $script:Result.message = $_.Exception.Message
} catch {
    $e = $_.Exception; while ($e.InnerException) { $e = $e.InnerException }
    $script:Result.code = 'internal'; $script:Result.message = "$($e.GetType().FullName): $($e.Message)"
}
Write-Result
exit $exit
