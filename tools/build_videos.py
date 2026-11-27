"""Generate the cinema playlist JSON from the actual video files.

Writes into <script type="application/json" id="videoData"> in index.html.
Filenames follow <model>.<method>.<scene>.vs.StepBridge.mp4.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEOS = os.path.join(ROOT, "assets", "videos")
POSTERS = os.path.join(ROOT, "assets", "posters")
INDEX = os.path.join(ROOT, "index.html")

# One merged, hand-ordered reel: strongest scenes first, methods/models
# interleaved so consecutive clips never look alike.
ORDER = [
    "1.3B.SMD.orange_cat_among_pink_flowers.vs.StepBridge.mp4",
    "14B.SMD.steam_train_on_stone_arch_viaduct.vs.StepBridge.mp4",
    "14B.SMD.dragon_breathing_fire_over_city.vs.StepBridge.mp4",
    "14B.DMD.white_church_on_seaside_cliff.vs.StepBridge.mp4",
    "1.3B.SMD.white_suv_on_forest_dirt_road.vs.StepBridge.mp4",
    "14B.DMD.steam_train_on_green_valley_viaduct.vs.StepBridge.mp4",
    "1.3B.DMD.orange_cat_walking_in_flower_garden.vs.StepBridge.mp4",
    "14B.SMD.aerial_coastal_cliffs_and_turquoise_bay.vs.StepBridge.mp4",
    "1.3B.SMD.old_man_with_beret_in_street_crowd.vs.StepBridge.mp4",
    "14B.DMD.fire_dragon_over_skyscrapers.vs.StepBridge.mp4",
    "1.3B.DMD.train_crossing_stone_viaduct.vs.StepBridge.mp4",
    "14B.SMD.octopus_and_lobster_on_seabed.vs.StepBridge.mp4",
    "14B.SMD.orange_cat_in_flower_garden.vs.StepBridge.mp4",
    "14B.DMD.otter_surfing_in_life_jacket.vs.StepBridge.mp4",
    "14B.SMD.white_suv_on_mountain_forest_road.vs.StepBridge.mp4",
]

TITLES = {
    "fire_dragon_between_skyscrapers": "Fire dragon between skyscrapers",
    "orange_cat_walking_in_flower_garden": "Orange cat walking in a flower garden",
    "train_crossing_stone_viaduct": "Train crossing a stone viaduct",
    "old_man_with_beret_in_street_crowd": "Old man with a beret in a street crowd",
    "orange_cat_among_pink_flowers": "Orange cat among pink flowers",
    "white_suv_on_forest_dirt_road": "White SUV on a forest dirt road",
    "fire_dragon_over_skyscrapers": "Fire dragon over skyscrapers",
    "otter_surfing_in_life_jacket": "Otter surfing in a life jacket",
    "steam_train_on_green_valley_viaduct": "Steam train on a green-valley viaduct",
    "white_church_on_seaside_cliff": "White church on a seaside cliff",
    "aerial_coastal_cliffs_and_turquoise_bay": "Aerial coastal cliffs and turquoise bay",
    "dragon_breathing_fire_over_city": "Dragon breathing fire over a city",
    "octopus_and_lobster_on_seabed": "Octopus and lobster on the seabed",
    "orange_cat_in_flower_garden": "Orange cat in a flower garden",
    "steam_train_on_stone_arch_viaduct": "Steam train on a stone-arch viaduct",
    "white_suv_on_mountain_forest_road": "White SUV on a mountain forest road",
}

missing = [f for f in ORDER if not os.path.exists(os.path.join(VIDEOS, f))]
if missing:
    raise SystemExit("Missing video files: " + ", ".join(missing))

items = []
for filename in ORDER:
    m = re.match(r"^(1\.3B|14B)\.(SMD|DMD)\.(.+)\.vs\.StepBridge\.mp4$", filename)
    if not m:
        raise SystemExit("Unexpected video filename: " + filename)
    model_raw, method_raw, scene = m.groups()
    poster_path = os.path.join(POSTERS, filename[:-4] + ".jpg")
    if not os.path.exists(poster_path):
        raise SystemExit("Missing poster: " + poster_path)
    items.append(
        {
            "video": "assets/videos/" + filename,
            "poster": "assets/posters/" + filename[:-4] + ".jpg",
            "title": TITLES.get(scene, scene.replace("_", " ").capitalize()),
            "model": model_raw,
            "method": method_raw,
        }
    )

payload = json.dumps(items, indent=2, ensure_ascii=False)
html = open(INDEX, encoding="utf-8").read()
pattern = re.compile(
    r'(<script type="application/json" id="videoData">)(.*?)(</script>)', re.S
)
html, n = pattern.subn(lambda m: m.group(1) + "\n" + payload + "\n" + m.group(3), html)
if n != 1:
    raise SystemExit(f"Expected one #videoData block, replaced {n}.")
open(INDEX, "w", encoding="utf-8", newline="\n").write(html)
print(f"Wrote {len(items)} clips into #videoData")
