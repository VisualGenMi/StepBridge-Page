"""Compose a 1200x630 social preview card for the StepBridge project page."""
import math
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = (250, 248, 244)
INK = (16, 24, 40)
INK2 = (59, 69, 89)
MUTED = (109, 118, 136)
BLUE = (40, 95, 166)
WARM = (184, 107, 75)
VIOLET = (106, 99, 168)

GEO = r"C:\Windows\Fonts\georgia.ttf"
SEG = r"C:\Windows\Fonts\segoeui.ttf"
SEG_SB = r"C:\Windows\Fonts\seguisb.ttf"
SEG_B = r"C:\Windows\Fonts\segoeuib.ttf"

base = Image.new("RGB", (W, H), PAPER)
px = base.load()

# Soft corner glows.
for y in range(H):
    for x in range(W):
        r, g, b = PAPER
        d1 = math.hypot(x - 90, y - 30) / 760
        d2 = math.hypot(x - 1140, y - 40) / 720
        a1 = max(0.0, 1 - d1) ** 2 * 0.20
        a2 = max(0.0, 1 - d2) ** 2 * 0.18
        r = int(r * (1 - a1 - a2) + BLUE[0] * a1 + WARM[0] * a2)
        g = int(g * (1 - a1 - a2) + BLUE[1] * a1 + WARM[1] * a2)
        b = int(b * (1 - a1 - a2) + BLUE[2] * a1 + WARM[2] * a2)
        px[x, y] = (r, g, b)

draw = ImageDraw.Draw(base, "RGBA")

# Bottom gradient strip.
bar = Image.new("RGB", (W, 8))
bp = bar.load()
for x in range(W):
    t = x / (W - 1)
    k = t / 0.5 if t < 0.5 else (t - 0.5) / 0.5
    c0, c1 = (BLUE, VIOLET) if t < 0.5 else (VIOLET, WARM)
    bp[x, 0] = tuple(int(c0[i] + (c1[i] - c0[i]) * k) for i in range(3))
    bp[x, 7] = bp[x, 0]
base.paste(bar, (0, H - 8))

# Gradient logo tile.
tile = Image.new("RGB", (72, 72))
tp = tile.load()
for y in range(72):
    for x in range(72):
        t = (x + y) / 142
        if t < 0.5:
            k = t / 0.5
            c = tuple(int(BLUE[i] + (VIOLET[i] - BLUE[i]) * k) for i in range(3))
        else:
            k = (t - 0.5) / 0.5
            c = tuple(int(VIOLET[i] + (WARM[i] - VIOLET[i]) * k) for i in range(3))
        tp[x, y] = c
mask = Image.new("L", (72, 72), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 71, 71], radius=20, fill=255)
base.paste(tile, (72, 62), mask)
d2 = ImageDraw.Draw(base, "RGBA")
# the two-step glyph: one riser, one tread, a dot at the clean endpoint
d2.line([(86, 118), (106, 94), (132, 94)], fill=(255, 255, 255, 245), width=5, joint="curve")
d2.ellipse([(132 - 4, 94 - 4), (132 + 4, 94 + 4)], fill=(255, 255, 255, 250))

f_brand = ImageFont.truetype(SEG_B, 30)
f_meta = ImageFont.truetype(SEG, 17)
f_title = ImageFont.truetype(GEO, 55)
f_sub = ImageFont.truetype(SEG, 21)
f_num = ImageFont.truetype(GEO, 46)
f_lab = ImageFont.truetype(SEG, 16)
f_foot = ImageFont.truetype(SEG, 15)

draw.text((162, 72), "StepBridge", font=f_brand, fill=INK)
draw.text((162, 108), "Project page  ·  2027", font=f_meta, fill=MUTED)

lines = [
    "Unifying Trajectory and Distribution",
    "Supervision for Efficient Two-Step",
    "Diffusion Generation",
]
y = 196
for line in lines:
    draw.text((74, y), line, font=f_title, fill=INK)
    y += 63

# Italic-ish accent underline on "Two-Step" is skipped for layout safety.
draw.text((76, 402), "Trajectory + distribution supervision for two-step video generation,",
          font=f_sub, fill=INK2)
draw.text((76, 432), "with zero extra inference cost.", font=f_sub, fill=INK2)

# Gradient rule.
rule = Image.new("RGB", (1046, 2))
rp = rule.load()
for x in range(1046):
    t = x / 1045
    if t < 0.5:
        k = t / 0.5
        c = tuple(int(BLUE[i] + (VIOLET[i] - BLUE[i]) * k) for i in range(3))
    else:
        k = (t - 0.5) / 0.5
        c = tuple(int(VIOLET[i] + (WARM[i] - VIOLET[i]) * k) for i in range(3))
    rp[x, 0] = c
    rp[x, 1] = c
base.paste(rule, (76, 492))

stats = [
    ("+2.15", "VBench Total  2-step SMD"),
    ("83.78", "Best 2-step score  DMD + StepBridge"),
    ("1.84 s", "Per video  2 NFE  18.4 GB"),
]
x = 76
for i, (num, label) in enumerate(stats):
    draw.text((x, 508), num, font=f_num, fill=INK)
    draw.text((x, 566), label, font=f_lab, fill=MUTED)
    x += 360

draw.text((76, 599), "MiLM Plus, Xiaomi Inc.  ·  School of Computer Science, Wuhan University", font=f_foot, fill=MUTED)
draw.text((1010, 599), "2027", font=f_foot, fill=MUTED)

out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "og.png")
base.save(out, optimize=True)
print("og.png", base.size)
