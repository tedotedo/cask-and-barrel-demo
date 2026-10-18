#!/usr/bin/env python3
"""Make responsive AVIF/WebP/JPEG variants.  Usage: make_images.py SOURCE OUT_BASE W1 [W2 ...]
Example: make_images.py pub-front.jpg images/pub-front 480 800 1280 1600   (needs Pillow >= 11.3 for AVIF)"""
import sys
from PIL import Image
src, base, *ws = sys.argv[1:]
im = Image.open(src).convert('RGB')
for w in map(int, ws):
    r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w < im.width else im
    r.save(f'{base}-{w}.jpg', quality=78, optimize=True, progressive=True)
    r.save(f'{base}-{w}.webp', quality=74, method=6)
    r.save(f'{base}-{w}.avif', quality=55, speed=6)
print('done; full size is', im.size)
