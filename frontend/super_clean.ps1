Add-Type -AssemblyName System.Drawing

function Super-Clean($path) {
    if (!(Test-Path $path)) { return }
    Write-Host "Limpando agressivamente: $path"
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)
    
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            # Remove white/grey checkerboard
            if ($pixel.R -gt 160 -and $pixel.G -gt 160 -and $pixel.B -gt 160) {
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $newBmp.SetPixel($x, $y, $pixel)
            }
        }
    }
    
    $bmp.Dispose()
    $newBmp.Save($path + ".final.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $newBmp.Dispose()
    Move-Item -Path ($path + ".final.png") -Destination $path -Force
    Write-Host "Pronto!"
}

Super-Clean "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\mangrove_root.png"
Super-Clean "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab.png"
Super-Clean "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab_attack.png"
Super-Clean "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\ground.png"
