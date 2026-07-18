"""Turn the supplied logo JPG into usable UI assets.

The source is a 1024x1024 JPEG: brass emblem on a near-black field, with a
"PRAHARI / CRIME-INTELLIGENCE PLATFORM" wordmark baked in underneath.
Three problems for UI use:

  1. JPEG has no alpha, and its background (23,28,31) is not the app
     background (#15181c = 21,24,28) -- pasting it shows a seam.
  2. The header already renders its own wordmark, so the baked-in text
     would duplicate it.
  3. 1024px / 370 KB is far more than a 28px header mark needs.

So: crop to the emblem, convert luminance to alpha (dark -> transparent),
and emit small PNGs. Keying dark to transparent also preserves the
intended negative-space read -- the Karnataka silhouette inside the shield
is dark, so it becomes a true cut-out that shows the page through it.

Run from PRAHARI/:  python make_brand_assets.py
"""
import pathlib
import subprocess

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "prahari_logo.jpg"
VIDEO_SRC = ROOT / "prahari_loadingscreen.mp4"
OUT = ROOT / "frontend" / "public" / "brand"

# measured from the source: emblem occupies y 124-743, wordmark starts y 777
EMBLEM_BOX = (200, 110, 825, 756)

# luminance (sum of RGB, 0-765) mapped to alpha
LO, HI = 120, 300


def to_rgba(img: Image.Image) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    lum = a.sum(axis=2)
    alpha = np.clip((lum - LO) / (HI - LO), 0.0, 1.0)

    # Un-premultiply toward the brass so JPEG ringing near edges does not
    # leave a dark halo when composited on the dark UI.
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(a / safe, 0, 255)

    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")
    OUT.mkdir(parents=True, exist_ok=True)

    full = Image.open(SRC)
    emblem = to_rgba(full.crop(EMBLEM_BOX))

    # square canvas so the mark scales predictably in flex rows
    side = max(emblem.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(emblem, ((side - emblem.width) // 2, (side - emblem.height) // 2))

    for name, px in [("mark-256.png", 256), ("mark-96.png", 96), ("mark-48.png", 48)]:
        canvas.resize((px, px), Image.LANCZOS).save(OUT / name, optimize=True)
        print(f"{name:16s} {(OUT / name).stat().st_size / 1024:6.1f} KB")

    # favicon: browsers render it at 16-32px, so bias toward the shield
    canvas.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png", optimize=True)
    print(f"{'favicon.png':16s} {(OUT / 'favicon.png').stat().st_size / 1024:6.1f} KB")

    # full lockup (emblem + wordmark) for the landing hero / share cards
    lockup = to_rgba(full.crop((150, 110, 875, 915)))
    lockup.thumbnail((520, 520), Image.LANCZOS)
    lockup.save(OUT / "lockup.png", optimize=True)
    print(f"{'lockup.png':16s} {(OUT / 'lockup.png').stat().st_size / 1024:6.1f} KB")

    encode_splash()


def encode_splash():
    """Re-encode the console splash clip.

    The supplied file is 10 s / 2.7 MB. At that size it contended with the
    lazily-loaded console chunk and pushed its download from 6.9 s to
    10.3 s -- i.e. the loading animation made loading slower. The splash is
    usually on screen for 1-3 s and sits behind a 60% scrim, so 6 s at
    960px / CRF 32 with no audio is indistinguishable and ~25x smaller.
    """
    if not VIDEO_SRC.exists():
        print("(no prahari_loadingscreen.mp4 -- skipping splash encode)")
        return
    try:
        import imageio_ffmpeg
    except ImportError:
        print("(pip install imageio-ffmpeg to re-encode the splash clip)")
        return

    dst = OUT / "loading.mp4"
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", str(VIDEO_SRC),
         "-t", "6", "-an",
         "-vf", "scale=960:-2,fps=24",
         "-c:v", "libx264", "-crf", "32", "-preset", "veryslow",
         "-profile:v", "main", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", str(dst)],
        check=True, capture_output=True,
    )
    print(f"{'loading.mp4':16s} {dst.stat().st_size / 1024:6.1f} KB "
          f"(from {VIDEO_SRC.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
