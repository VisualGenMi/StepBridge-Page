"""Render paper figure PDFs to web-ready PNGs for the StepBridge project page.

Usage (from anywhere):
    python tools/render_figures.py

Reads ../paper/CVPR2027_2steps_opd_dmd/fig/*.pdf and writes PNGs to
assets/figures/. Convert to WebP afterwards if you want smaller files.
"""
import os

import pymupdf

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(SITE), "paper", "CVPR2027_2steps_opd_dmd", "fig")
OUT = os.path.join(SITE, "assets", "figures")
os.makedirs(OUT, exist_ok=True)

# name, zoom; higher zoom for wide multi-panel figures
FIGS = {
    "fig1": 4.0,
    "fig2": 4.0,
    "fig3": 4.0,
    "fig4": 4.0,
    "fig5": 5.0,
    "fig6": 4.0,
    "fig_ex": 4.0,
}

for name, zoom in FIGS.items():
    path = os.path.join(SRC, name + ".pdf")
    doc = pymupdf.open(path)
    page = doc[0]
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    out = os.path.join(OUT, name + ".png")
    pix.save(out)
    print(f"{name}: {pix.width}x{pix.height} -> {os.path.getsize(out) / 1e6:.2f} MB")
    doc.close()
