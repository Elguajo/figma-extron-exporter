<#
    Draws the example's own icons: a 64x64 music note on transparency, light and
    dark. Run once with Windows PowerShell; the PNGs are committed with the example.
      powershell -NoProfile -File New-NoteIcons.ps1
#>
Add-Type -AssemblyName System.Drawing
foreach ($v in @(@{ name = 'note-light.png'; color = [Drawing.Color]::FromArgb(255, 255, 255, 255) },
                 @{ name = 'note-dark.png'; color = [Drawing.Color]::FromArgb(255, 27, 27, 31) })) {
    $bmp = New-Object Drawing.Bitmap(64, 64, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([Drawing.Color]::Transparent)
    $brush = New-Object Drawing.SolidBrush($v.color)
    $g.FillEllipse($brush, 10, 42, 18, 14)
    $g.FillEllipse($brush, 34, 36, 18, 14)
    $g.FillRectangle($brush, 24, 10, 4, 40)
    $g.FillRectangle($brush, 48, 6, 4, 38)
    $g.FillPolygon($brush, [Drawing.Point[]]@((New-Object Drawing.Point(24, 10)), (New-Object Drawing.Point(52, 4)), (New-Object Drawing.Point(52, 14)), (New-Object Drawing.Point(24, 20))))
    $g.Dispose()
    $bmp.Save((Join-Path $PSScriptRoot $v.name), [Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
