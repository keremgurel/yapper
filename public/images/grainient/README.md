# Stage backdrops

Five original backdrops, one per Studio stage: soft diagonal light streaks, a
shaft of light from the top-right corner and fine film grain. They sit behind
product demonstrations on the public site and the sign-in carousel.

They are rendered by `scripts/generate-backdrops.py` (numpy and Pillow) and
committed as static WebP. Nothing is drawn at runtime. To change a palette,
edit `PALETTES` in the script and run it again; the output is deterministic.

| Stage   | Base      | Colours                                    |
| ------- | --------- | ------------------------------------------ |
| Ideas   | `#0b1730` | `#1f4fa8`, `#5f9bf0`, `#bcd9ff`, `#2a3f86` |
| Script  | `#1a0f2c` | `#6a2f7a`, `#c2588f`, `#f0a9b4`, `#3a2466` |
| Record  | `#041a20` | `#0f6f73`, `#3fb5a4`, `#c8efe0`, `#16465c` |
| Edit    | `#1c0e16` | `#e2573a`, `#f3a27c`, `#8a2f5a`, `#f6d2bd` |
| Publish | `#120f2e` | `#4a3fc0`, `#8f7cf2`, `#d8ccff`, `#2a2a7a` |

Portrait images are 960×1200; wide images are 2000×1125.
