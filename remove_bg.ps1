$inputPath = "C:\Users\ags-aju-dev-001\.gemini\antigravity\brain\77062b5e-0dbf-482d-90e3-c0ddcfb99997\catador_ultra_lowres_final_1777312236763.png"
$outputPath = "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\catador_spritesheet.png"

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
$newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        # Threshold for black: If R, G, and B are all below 35, make it transparent
        if ($pixel.R -lt 35 -and $pixel.G -lt 35 -and $pixel.B -lt 35) {
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $newBmp.SetPixel($x, $y, $pixel)
        }
    }
}

$newBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$newBmp.Dispose()
Write-Host "Background removed via PowerShell!"
