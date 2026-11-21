"""Renders each cbshots screenshot as seen with deuteranopia, protanopia and tritanopia
(Machado, Oliveira and Fernandes 2009, severity 1.0, applied in linear RGB) and lays
them out in one sheet per shot: normal | deuteranopia | protanopia | tritanopia.
Usage: python3 tools/cbsim.py <dir>   (reads *-cb-*.png, writes *-cbsim.jpg)"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw

M = {
    'deuteranopia': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'protanopia': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'tritanopia': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}

def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def srgb(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, 1), 1 / 2.4) - 0.055)

def sim(im, m):
    a = lin(np.asarray(im.convert('RGB'), dtype=np.float64) / 255.0)
    b = np.clip(a @ np.array(m).T, 0, 1)
    return Image.fromarray((srgb(b) * 255 + 0.5).astype(np.uint8))

for f in sorted(glob.glob(os.path.join(sys.argv[1], '*-cb-*.png'))):
    im = Image.open(f).convert('RGB')
    w = 640; h = im.height * w // im.width
    im = im.resize((w, h))
    tiles = [('normal', im)] + [(k, sim(im, v)) for k, v in M.items()]
    sheet = Image.new('RGB', (w * 2, h * 2))
    for i, (name, t) in enumerate(tiles):
        d = ImageDraw.Draw(t); d.rectangle([0, 0, 150, 20], fill=(0, 0, 0)); d.text((6, 4), name, fill=(255, 255, 255))
        sheet.paste(t, ((i % 2) * w, (i // 2) * h))
    sheet.save(f.replace('.png', '-cbsim.jpg'), quality=85)
    print(f)
