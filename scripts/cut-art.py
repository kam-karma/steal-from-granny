"""Cut one piece of art (on a flat white background) out tight, keeping its shape.

Usage: python scripts/cut-art.py in.jpg out.webp width
"""
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out, width = sys.argv[1], sys.argv[2], int(sys.argv[3])
img = Image.open(src).convert('RGB')
rgb = np.asarray(img).astype(np.int16)
white = (rgb.min(axis=2) > 228) & (rgb.max(axis=2) - rgb.min(axis=2) < 22)
labels, _ = ndimage.label(white)
edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
fg = ~np.isin(labels, edge[edge > 0])
# Keep only sizeable parts (drop specks).
parts, n = ndimage.label(fg)
sizes = ndimage.sum(np.ones_like(parts), parts, range(1, n + 1))
fg = np.isin(parts, [i + 1 for i, v in enumerate(sizes) if v > 2000])
alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
rgba = img.convert('RGBA')
rgba.putalpha(alpha)
ys, xs = np.where(fg)
rgba = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
h = round(rgba.height * width / rgba.width)
rgba.resize((width, h), Image.LANCZOS).save(out, 'WEBP', quality=90, method=6)
print(out, width, h)
