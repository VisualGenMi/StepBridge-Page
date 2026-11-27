"""Remove only the burned-in title strip (top 56 rows) from every clip.

The 56 px band carries "Original | + StepBridge" baked at 9 px tall. At the
six-up wall a tile is ~423 px wide, so that text renders ~2 px high and turns
into antialiasing mush. The page now draws its own crisp HTML labels, so the
baked strip is removed -- image content below row 56 is untouched.

1664x536 -> 1664x480
"""
import os
import shutil
import subprocess

import imageio_ffmpeg

ROOT = r"C:\Users\yinboliu\Documents\StepBridge\StepBridge-Page"
SRC = os.path.join(os.path.dirname(ROOT), "videos_original")
VID = os.path.join(ROOT, "assets", "videos")
POSTER = os.path.join(ROOT, "assets", "posters")
FF = imageio_ffmpeg.get_ffmpeg_exe()

SRC_H, CROP_Y, OUT_H = 536, 56, 480

names = sorted(f for f in os.listdir(SRC) if f.endswith(".mp4"))
if not names:
    raise SystemExit("no source clips in videos_original")

for name in names:
    src = os.path.join(SRC, name)
    tmp = os.path.join(VID, "_tmp_" + name)
    subprocess.run(
        [FF, "-y", "-loglevel", "error", "-i", src,
         "-vf", f"crop=1664:{OUT_H}:0:{CROP_Y}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "20",
         "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", tmp],
        check=True,
    )
    out = os.path.join(VID, name)
    os.replace(tmp, out)

    subprocess.run(
        [FF, "-y", "-loglevel", "error", "-ss", "0.35", "-i", out,
         "-frames:v", "1", "-vf", "scale=1248:-2", "-q:v", "3",
         os.path.join(POSTER, name[:-4] + ".jpg")],
        check=True,
    )
    print(f"{name}: {OUT_H}p")

print(f"done: {len(names)} clips cropped to 1664x{OUT_H}")
