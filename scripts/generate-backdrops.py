#!/usr/bin/env python3
"""Render the five stage backdrops in public/images/grainient.

Each backdrop is a field of soft diagonal light streaks in one stage palette,
finished with a shaft of light from a top corner and fine film grain. The
output is deterministic: the same seed gives the same image.

    python3 scripts/generate-backdrops.py

Needs numpy and Pillow. Nothing is rendered at runtime; the site ships the
WebP files this writes.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public/images/grainient"

# name: (seed, streak angle in degrees, base colour, [colours laid over it])
PALETTES = {
    "ideas": (11, -32, "#0b1730", ["#1f4fa8", "#5f9bf0", "#bcd9ff", "#2a3f86"]),
    "script": (23, -28, "#1a0f2c", ["#6a2f7a", "#c2588f", "#f0a9b4", "#3a2466"]),
    "record": (37, -36, "#041a20", ["#0f6f73", "#3fb5a4", "#c8efe0", "#16465c"]),
    "edit": (41, -30, "#1c0e16", ["#e2573a", "#f3a27c", "#8a2f5a", "#f6d2bd"]),
    "publish": (59, -34, "#120f2e", ["#4a3fc0", "#8f7cf2", "#d8ccff", "#2a2a7a"]),
}


def rgb(hex_colour):
    h = hex_colour.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def noise(rng, shape, cells):
    """Smooth value noise: a small random grid stretched to `shape`."""
    grid = rng.random((cells[1], cells[0])).astype(np.float32)
    img = Image.fromarray((grid * 255).astype(np.uint8))
    img = img.resize((shape[1], shape[0]), Image.BICUBIC)
    return np.asarray(img, dtype=np.float32) / 255


def streaks(rng, size, angle):
    """Noise that is long along one axis and short across it, then rotated."""
    w, h = size
    side = int(np.hypot(w, h)) + 8
    field = 0.62 * noise(rng, (side, side), (3, 9))
    field += 0.28 * noise(rng, (side, side), (4, 22))
    field += 0.10 * noise(rng, (side, side), (6, 60))
    img = Image.fromarray((np.clip(field, 0, 1) * 255).astype(np.uint8))
    img = img.rotate(angle, resample=Image.BICUBIC)
    left, top = (side - w) // 2, (side - h) // 2
    img = img.crop((left, top, left + w, top + h))
    return np.asarray(img, dtype=np.float32) / 255


def contrast(x, low, high):
    return np.clip((x - low) / (high - low), 0, 1) ** 1.5


def render(name, size):
    seed, angle, base, colours = PALETTES[name]
    rng = np.random.default_rng(seed)
    w, h = size
    img = np.empty((h, w, 3), dtype=np.float32)
    img[:] = rgb(base)

    # Each colour gets its own streak field, so the bands cross and overlap.
    for i, colour in enumerate(colours):
        mask = contrast(streaks(rng, size, angle + rng.uniform(-5, 5)), 0.5, 0.8)
        mask *= 0.9 if i < 2 else 0.7
        img += (rgb(colour) - img) * mask[..., None]

    # Darken toward the lower left so the lit corner has something to read
    # against, and product screens set on top keep their contrast.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx, ny = xx / w, yy / h
    shade = np.clip(1.15 - 0.75 * ((1 - nx) * 0.6 + ny * 0.8), 0.35, 1)
    img *= shade[..., None]

    # The shaft of light: a soft band entering from the top-right corner.
    across = (nx - 1) * np.cos(np.radians(52)) + ny * np.sin(np.radians(52))
    shaft = np.exp(-((across + 0.02) ** 2) / 0.012) * np.clip(1.2 - ny * 1.5, 0, 1)
    shaft *= 0.5 + 0.5 * streaks(rng, size, -52)
    img += (255 - img) * (shaft * 0.42)[..., None]

    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out = out.filter(ImageFilter.GaussianBlur(radius=w / 260))
    out = ImageEnhance.Color(out).enhance(1.3)
    out = ImageEnhance.Contrast(out).enhance(1.08)

    # Film grain goes on after the blur so it stays crisp.
    arr = np.asarray(out, dtype=np.float32)
    grain = rng.normal(0, 6, (h, w, 1)).astype(np.float32)
    return Image.fromarray(np.clip(arr + grain, 0, 255).astype(np.uint8))


def main():
    for name in PALETTES:
        render(name, (960, 1200)).save(OUT / f"{name}.webp", quality=70)
        render(name, (2000, 1125)).save(OUT / f"{name}-wide.webp", quality=70)
        print("wrote", name)


if __name__ == "__main__":
    main()
