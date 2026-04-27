$inputPath = "C:\Users\ags-aju-dev-001\.gemini\antigravity\brain\77062b5e-0dbf-482d-90e3-c0ddcfb99997\uca_heart_pixelart_lowres_1777311870668.png"
$outputPath = "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\heart_clean.png"

Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
$newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)

for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $pixel = $bmp.GetPixel($x, $y)
        # Threshold for black/dark colors
        if ($pixel.R -lt 40 -and $pixel.G -lt 40 -and $pixel.B -lt 40) {
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
        } else {
            $newBmp.SetPixel($x, $y, $pixel)
        }
    }
}

$newBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$newBmp.Dispose()
Write-Host "Heart background removed!"
