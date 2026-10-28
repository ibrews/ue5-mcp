#!/usr/bin/env python3
"""Rasterize the editable SVG icon; requires rsvg-convert and Pillow."""
from pathlib import Path
from io import BytesIO
import subprocess
from PIL import Image

root = Path(__file__).resolve().parent
def render(size):
    data = subprocess.check_output(['rsvg-convert', '--width', str(size), '--height', str(size), str(root/'favicon.svg')])
    return Image.open(BytesIO(data)).convert('RGBA')

render(32).save(root/'favicon-32.png')
render(180).save(root/'apple-touch-icon.png')
sizes = [16, 24, 32, 48, 64, 128, 256]
frames = [render(size) for size in sizes]
frames[-1].save(root/'favicon.ico', sizes=[(s, s) for s in sizes], append_images=frames[:-1])
print('Generated PNG, Apple touch icon and seven-size ICO from favicon.svg')
