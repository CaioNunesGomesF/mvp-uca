Add-Type -AssemblyName System.Drawing

function Clean-Transparency($inputPath) {
    if (-not (Test-Path $inputPath)) { return }
    Write-Host "Processing $inputPath..."
    
    $bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
    $newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)
    
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
        # Threshold for white/light colors (checkerboard detection)
        if ($pixel.R -gt 190 -and $pixel.G -gt 190 -and $pixel.B -gt 190) {
            $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } else {
            $newBmp.SetPixel($x, $y, $pixel)
        }
        }
    }
    
    $tempPath = $inputPath + ".tmp.png"
    $newBmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $newBmp.Dispose()
    
    Move-Item -Path $tempPath -Destination $inputPath -Force
    Write-Host "Done!"
}

$assets = @(
    "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\heart_new.png",
    "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab.png",
    "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab_attack.png",
    "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\mangrove_root.png"
)

foreach ($asset in $assets) {
    Clean-Transparency $asset
}
