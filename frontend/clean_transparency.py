from PIL import Image
import os

def make_transparent(file_path):
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    img = Image.open(file_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # If the pixel is very close to white (background), make it transparent
        # Threshold 240 to catch "almost white" pixels from compression
        if item[0] > 220 and item[1] > 220 and item[2] > 220:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(file_path, "PNG")
    print(f"Processed {file_path}")

# List of assets to clean
assets = [
    r"c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\heart_new.png",
    r"c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab.png",
    r"c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\uca_crab_attack.png"
]

for asset in assets:
    make_transparent(asset)
