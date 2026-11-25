"""Preview icons on the game's dark panel colour: python scripts/contact-sheet.py out.png icon1.webp ..."""
import sys
from PIL import Image

out, files = sys.argv[1], sys.argv[2:]
n = len(files)
cols = min(8, n)
rows = (n + cols - 1) // cols
cell = 140
sheet = Image.new('RGBA', (cols * cell, rows * cell), (42, 31, 82, 255))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA').resize((120, 120), Image.LANCZOS)
    sheet.alpha_composite(im, ((i % cols) * cell + 10, (i // cols) * cell + 10))
sheet.save(out)
