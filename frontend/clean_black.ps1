Add-Type -AssemblyName System.Drawing

function Clean-Black($inputPath) {
    if (-not (Test-Path $inputPath)) { return }
    Write-Host "Limpando fundo preto de $inputPath..."
    
    $bmp = [System.Drawing.Bitmap]::FromFile($inputPath)
    $newBmp = New-Object System.Drawing.Bitmap($bmp.Width, $bmp.Height)
    
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        for ($x = 0; $x -lt $bmp.Width; $x++) {
            $pixel = $bmp.GetPixel($x, $y)
            # Threshold for black/dark colors
            if ($pixel.R -lt 40 -and $pixel.G -lt 40 -and $pixel.B -lt 40) {
                $newBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $newBmp.SetPixel($x, $y, $pixel)
            }
        }
    }
    
    $tempPath = $inputPath + ".tmp_black.png"
    $newBmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $newBmp.Dispose()
    
    Move-Item -Path $tempPath -Destination $inputPath -Force
    Write-Host "Pronto!"
}

$items = @(
    "c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\items_spritesheet.png"
)

foreach ($item in $items) {
    Clean-Black $item
}
