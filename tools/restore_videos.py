"""Restore full-frame videos and regenerate uncropped posters.

The comparison clips already carry an "Original | + StepBridge" title row.
Earlier we cropped it off; the 2x2 wall keeps the full frame instead, so the
baked header doubles as the column legend.
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

os.makedirs(VID, exist_ok=True)
os.makedirs(POSTER, exist_ok=True)

names = sorted(f for f in os.listdir(SRC) if f.endswith(".mp4"))
if len(names) != 15:
    raise SystemExit(f"expected 15 source clips, found {len(names)}")

for name in names:
    shutil.copy2(os.path.join(SRC, name), os.path.join(VID, name))
    subprocess.run(
        [
            FF, "-y", "-loglevel", "error", "-ss", "0.35",
            "-i", os.path.join(VID, name),
            "-frames:v", "1", "-vf", "scale=1248:-2", "-q:v", "3",
            os.path.join(POSTER, name[:-4] + ".jpg"),
        ],
        check=True,
    )
    print(f"{name}: restored")

# drop the orphaned poster of the removed 1.3B fire-dragon clip
orphan = os.path.join(POSTER, "1.3B.DMD.fire_dragon_between_skyscrapers.vs.StepBridge.jpg")
if os.path.exists(orphan):
    os.remove(orphan)
    print("removed orphan poster")

print(f"restored {len(names)} clips (1664x536, full frame)")
