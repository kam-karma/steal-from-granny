"""Cut a generated icon sheet (icons on a flat white background) into separate transparent WebP icons.

Usage: python scripts/cut-icons.py sheet.png out_dir name1 name2 ... [--size 192] [--cols 4] [--holes name,name]
--holes: for these icons, closed pure-white areas (like the hole of a ring) are cut out too.
--keep: keep each piece's own shape (no square padding); --size is then the width.
Icons are found as separate blobs and named in reading order (rows top to bottom, left to right).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage


def args():
    a = sys.argv[1:]
    size = 192
    cols = 4
    holes = set()
    keep_shape = '--keep' in a
    if keep_shape:
        a.remove('--keep')
    if '--holes' in a:
        i = a.index('--holes')
        holes = set(a[i + 1].split(','))
        del a[i:i + 2]
    if '--size' in a:
        i = a.index('--size')
        size = int(a[i + 1])
        del a[i:i + 2]
    if '--cols' in a:
        i = a.index('--cols')
        cols = int(a[i + 1])
        del a[i:i + 2]
    return Path(a[0]), Path(a[1]), a[2:], size, cols, holes, keep_shape


def background(rgb: np.ndarray) -> np.ndarray:
    """White-ish pixels connected to the image border are background."""
    near_white = (rgb.min(axis=2) > 228) & (rgb.max(axis=2) - rgb.min(axis=2) < 22)
    labels, _ = ndimage.label(near_white)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    return np.isin(labels, edge[edge > 0])


def enclosed_gaps(cell: np.ndarray, inside: np.ndarray, force: bool) -> np.ndarray:
    """White areas closed in by the icon (inside a padlock shackle, a cog, a trophy handle).

    The sticker outline is dark plum, so a gap is a white patch whose rim is mostly dark.
    White parts of an object (a check mark, a washing machine) sit on coloured paint, not on the outline.
    """
    white = (cell.min(axis=2) > 228) & (cell.max(axis=2) - cell.min(axis=2) < 22) & inside
    labels, n = ndimage.label(white)
    dark = cell.max(axis=2) < 120
    gaps = np.zeros_like(white)
    for k in range(1, n + 1):
        region = labels == k
        if region.sum() < 150:
            continue
        rim = ndimage.binary_dilation(region, iterations=3) & ~region
        if force or dark[rim].mean() > 0.5:
            gaps |= ndimage.binary_dilation(region, iterations=1) & ~dark
    return gaps


def blobs(fg: np.ndarray, count: int, cols: int):
    """The `count` biggest foreground blobs, in reading order."""
    merged = ndimage.binary_dilation(fg, iterations=6)
    labels, n = ndimage.label(merged)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    keep = np.argsort(sizes)[::-1][:count] + 1
    boxes = [ndimage.find_objects((labels == k).astype(int))[0] for k in keep]
    centers = [((b[0].start + b[0].stop) / 2, (b[1].start + b[1].stop) / 2, b, k) for b, k in zip(boxes, keep)]
    centers.sort(key=lambda c: c[0])
    rows = [centers[i:i + cols] for i in range(0, len(centers), cols)]
    ordered = []
    for row in rows:
        ordered += sorted(row, key=lambda c: c[1])
    return labels, ordered


def main():
    sheet, out, names, size, cols, holes, keep_shape = args()
    out.mkdir(parents=True, exist_ok=True)
    img = Image.open(sheet).convert('RGB')
    rgb = np.asarray(img).astype(np.int16)
    bg = background(rgb)
    fg = ~bg
    labels, ordered = blobs(fg, len(names), cols)
    alpha_full = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    rgba = img.convert('RGBA')
    rgba.putalpha(alpha_full)
    for name, (_, _, box, k) in zip(names, ordered):
        ys, xs = box
        part = np.zeros_like(fg)
        part[ys, xs] = (labels[ys, xs] == k)
        crop = rgba.crop((xs.start, ys.start, xs.stop, ys.stop))
        mask = Image.fromarray((part[ys, xs] * 255).astype(np.uint8))
        keep = np.asarray(mask)
        gaps = enclosed_gaps(rgb[ys, xs], part[ys, xs], force=name in holes)
        if gaps.any():
            print(f'  {name}: cut {int(gaps.sum())} px of enclosed background')
            keep = np.where(gaps, 0, keep).astype(np.uint8)
        a = Image.fromarray(np.minimum(np.asarray(crop.getchannel('A')), keep))
        crop.putalpha(a)
        w, h = crop.size
        if keep_shape:
            crop.resize((size, round(h * size / w)), Image.LANCZOS).save(out / f'{name}.webp', 'WEBP', quality=86, method=6)
            print(f'{name}: {w}x{h}')
            continue
        side = int(max(w, h) * 1.06)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(crop, ((side - w) // 2, (side - h) // 2))
        canvas = canvas.resize((size, size), Image.LANCZOS)
        canvas.save(out / f'{name}.webp', 'WEBP', quality=88, method=6)
        print(f'{name}: {w}x{h}')


if __name__ == '__main__':
    main()
