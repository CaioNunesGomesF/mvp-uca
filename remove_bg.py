from PIL import Image
import os

def remove_black_bg(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    newData = []
    for item in datas:
        # If the pixel is very close to black, make it transparent
        if item[0] < 30 and item[1] < 30 and item[2] < 30:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)

    img.putdata(newData)
    img.save(output_path, "PNG")

input_file = r"C:\Users\ags-aju-dev-001\.gemini\antigravity\brain\77062b5e-0dbf-482d-90e3-c0ddcfb99997\catador_ultra_lowres_final_1777312236763.png"
output_file = r"c:\Users\ags-aju-dev-001\Desktop\mvp-uca\frontend\public\catador_spritesheet.png"

remove_black_bg(input_file, output_file)
print("Background removed successfully!")
