"""Builds the landing's surface textures and sky from Poly Haven CC0 scans.

    python3 scripts/build-textures.py [download-folder]

Downloads (once) the 2k JPG maps of snow_02 and rock_06 and the 1k HDR of
snow_field from dl.polyhaven.org, then writes to public/tex/:
  <surface>_{col,nor,arm}_{1k,2k}.webp   colour, OpenGL normal, AO/rough/metal
  sky.png                                 512x256 HDR sky for lighting, as RGBE in a
                                          plain PNG: the top half holds the RGB
                                          mantissas, the bottom half the exponent
Colour maps are levelled to a bright neutral so the material colour sets the
tint; the rock is turned grey. All sources are CC0 (polyhaven.com/license).
"""
import os, sys, urllib.request
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'tex')
DL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'node_modules', '.cache', 'polyhaven')
TEX = {'snow': 'snow_02', 'rock': 'rock_06'}
SKY = 'snow_field'


def fetch(url, name):
    os.makedirs(DL, exist_ok=True)
    path = os.path.join(DL, name)
    if not os.path.exists(path):
        print('download', url)
        urllib.request.urlretrieve(url, path)
    return path


def save(img, name, q):
    for size, tag in ((2048, '2k'), (1024, '1k')):
        im = img if img.size[0] == size else img.resize((size, size), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{name}_{tag}.webp'), 'WEBP', quality=q, method=6)


def level_colour(path, grey, mean, contrast, floor=0.0):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    if grey:
        a = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None].repeat(3, -1)
    m = a.reshape(-1, 3).mean(0)
    a = np.maximum(a, m * floor)  # lift dark specks (twigs in the snow scan)
    a = (m + (a - m) * contrast) / m * mean  # neutral, bright; detail kept
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def read_hdr(fn):
    with open(fn, 'rb') as f:
        while f.readline().strip():
            pass
        dims = f.readline().split()
        H, W = int(dims[1]), int(dims[3])
        data, p = f.read(), 0
    out = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        p += 4
        for c in range(4):
            x = 0
            while x < W:
                n = data[p]; p += 1
                if n > 128:
                    n -= 128; out[y, x:x + n, c] = data[p]; p += 1
                else:
                    out[y, x:x + n, c] = np.frombuffer(data[p:p + n], np.uint8); p += n
                x += n
    return out[..., :3].astype(np.float32) * np.ldexp(1.0, out[..., 3].astype(np.int32) - 136)[..., None]


def write_rgbe_png(fn, rgb):
    """Shared-exponent HDR in an opaque 8-bit PNG (any host serves it, and an
    opaque image reads back exactly through a canvas)."""
    H, W, _ = rgb.shape
    m = rgb.max(-1)
    e = np.where(m > 1e-32, np.floor(np.log2(np.maximum(m, 1e-32))) + 1, -128)
    out = np.zeros((H * 2, W, 3), np.uint8)
    out[:H] = np.clip(rgb * (256.0 / np.exp2(e))[..., None], 0, 255).astype(np.uint8)
    out[H:] = np.clip(e + 128, 0, 255).astype(np.uint8)[..., None]
    Image.fromarray(out).save(fn, optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    base = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k'
    for key, asset in TEX.items():
        files = {m: fetch(f'{base}/{asset}/{asset}_{m}_2k.jpg', f'{asset}_{m}_2k.jpg') for m in ('diff', 'nor_gl', 'arm')}
        save(level_colour(files['diff'], key == 'rock', *((205, 1.15) if key == 'rock' else (238, 0.8, 0.93))), f'{key}_col', 74)
        save(Image.open(files['nor_gl']).convert('RGB'), f'{key}_nor', 80)
        save(Image.open(files['arm']).convert('RGB'), f'{key}_arm', 80)
    sky = read_hdr(fetch(f'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/{SKY}_1k.hdr', f'{SKY}_1k.hdr'))
    H, W, _ = sky.shape
    small = sky.reshape(H // 2, 2, W // 2, 2, 3).mean((1, 3))
    write_rgbe_png(os.path.join(OUT, 'sky.png'), small)
    for f in sorted(os.listdir(OUT)):
        print(f'{os.path.getsize(os.path.join(OUT, f)) / 1024:8.0f} KB  {f}')


main()
