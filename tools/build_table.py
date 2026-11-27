"""Rebuild the main comparison table body from the paper's Table 1 values."""
import os
import re

INDEX = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "index.html"
)

# label, nfe, group, total, quality, semantic, suco, baco, tefl, mosm, dyde, aequ, deviations
ROWS = [
    ("Wan2.1 teacher (1.3B)", "50", "four", "83.38", "84.11", "80.48", "0.9571", "0.9762", "0.9956", "0.9842", "0.6111", "0.6393", (".20", ".18", ".45")),
    ("SMD", "4", "four", "84.24", "85.54", "79.03", "0.9649", "0.9511", "0.9924", "0.9879", "0.7500", "0.6570", (".15", ".25", ".51")),
    ("DMD", "4", "four", "83.72", "84.68", "79.88", "0.9575", "0.9560", "0.9802", "0.9783", "0.7963", "0.6429", (".17", ".26", ".22")),
    ("DMD2", "4", "four", "84.26", "85.48", "79.39", "0.9678", "0.9616", "0.9923", "0.9868", "0.7593", "0.6529", (".19", ".15", ".55")),
    ("rCM", "4", "four", "84.40", "85.20", "81.17", "0.9525", "0.9598", "0.9900", "0.9804", "0.8333", "0.6476", (".22", ".20", ".30")),
    ("AnyFlow", "4", "four", "84.31", "85.10", "81.14", "0.9773", "0.9699", "0.9924", "0.9836", "0.6389", "0.6707", (".12", ".18", ".45")),
    ("SMD", "2", "two", "81.02", "82.82", "73.84", "0.9593", "0.9556", "0.9931", "0.9893", "0.6343", "0.6162", (".33", ".31", ".98")),
    ("DMD", "2", "two", "82.74", "83.77", "78.59", "0.9559", "0.9544", "0.9805", "0.9762", "0.7500", "0.6321", (".07", ".25", ".69")),
    ("DMD2", "2", "two", "83.13", "84.43", "77.94", "0.9672", "0.9583", "0.9951", "0.9889", "0.6667", "0.6305", (".02", ".08", ".29")),
    ("rCM", "2", "two", "83.51", "84.42", "79.86", "0.9527", "0.9552", "0.9915", "0.9808", "0.7269", "0.6470", (".27", ".24", ".65")),
    ("AnyFlow", "2", "two", "83.64", "84.31", "80.97", "0.9756", "0.9656", "0.9920", "0.9840", "0.5648", "0.6651", (".04", ".14", ".36")),
    ("SMD + StepBridge", "2", "ours", "83.17", "84.60", "77.43", "0.9626", "0.9597", "0.9930", "0.9900", "0.6065", "0.6523", (".25", ".21", ".88")),
    ("DMD + StepBridge", "2", "ours", "83.78", "84.75", "79.91", "0.9584", "0.9548", "0.9768", "0.9783", "0.7963", "0.6489", (".15", ".16", ".52")),
    ("DMD2 + StepBridge", "2", "ours", "83.31", "84.27", "79.44", "0.9607", "0.9577", "0.9912", "0.9878", "0.6389", "0.6413", (".12", ".22", ".44")),
]

# Ranks 1/2/3 among NFE=2 settings, per metric column (index into the 9 numeric values).
RANKS = {
    0: {1: "DMD + StepBridge", 2: "AnyFlow", 3: "rCM"},
    1: {1: "DMD + StepBridge", 2: "SMD + StepBridge", 3: "DMD2"},
    2: {1: "AnyFlow", 2: "DMD + StepBridge", 3: "rCM"},
    3: {1: "AnyFlow", 2: "DMD2", 3: "SMD + StepBridge"},
    4: {1: "AnyFlow", 2: "SMD + StepBridge", 3: "DMD2"},
    5: {1: "DMD2", 2: "SMD", 3: "SMD + StepBridge"},
    6: {1: "SMD + StepBridge", 2: "SMD", 3: "DMD2"},
    7: {1: "DMD + StepBridge", 2: "DMD", 3: "rCM"},
    8: {1: "AnyFlow", 2: "SMD + StepBridge", 3: "DMD + StepBridge"},
}
RANK_CLASS = {1: "cell-best", 2: "cell-second", 3: "cell-third"}

thead = """<thead>
              <tr>
                <th rowspan="2">Method</th>
                <th rowspan="2">NFE</th>
                <th colspan="3" class="group">VBench</th>
                <th colspan="5" class="group">Consistency &amp; motion</th>
                <th rowspan="2">Ae.Qu. &uarr;</th>
              </tr>
              <tr>
                <th>Total &uarr;</th>
                <th>Quality &uarr;</th>
                <th>Semantic &uarr;</th>
                <th>Su.Co. &uarr;</th>
                <th>Ba.Co. &uarr;</th>
                <th>Te.Fl. &uarr;</th>
                <th>Mo.Sm. &uarr;</th>
                <th>Dy.De. &uarr;</th>
              </tr>
            </thead>"""

body = ["            <tbody>"]
prev_group = None
for row in ROWS:
    label, nfe, group, *rest = row
    values = rest[:9]
    devs = rest[9]
    classes = []
    if group == "ours":
        classes.append("is-ours")
    if prev_group is not None and group != prev_group:
        classes.append("group-start")
    prev_group = group
    attr = f' class="{" ".join(classes)}"' if classes else ""
    body.append(f'              <tr data-group="{group}"{attr}>')
    body.append(f"                <td>{label}</td>")
    nfe_cls = "nfe nfe--2" if nfe == "2" else "nfe"
    body.append(f'                <td><span class="{nfe_cls}">{nfe}</span></td>')
    for i, val in enumerate(values):
        rank = None
        if group == "two" or group == "ours":
            for r, name in RANKS[i].items():
                if name == label:
                    rank = r
        cls = f' class="{RANK_CLASS[rank]}"' if rank else ""
        if i < 3:
            body.append(f'                <td{cls}>{val}<span class="pm">&pm;{devs[i]}</span></td>')
        else:
            body.append(f"                <td{cls}>{val}</td>")
    body.append("              </tr>")
body.append("            </tbody>")

new_block = thead + "\n" + "\n".join(body)

with open(INDEX, "r", encoding="utf-8") as fh:
    html = fh.read()

pattern = re.compile(
    r'(<table class="data" id="mainTable">\s*)(.*?)(\s*</table>)', re.S)
new_html, n = pattern.subn(lambda m: m.group(1) + new_block + m.group(3), html)
if n != 1:
    raise SystemExit(f"Expected one main table, replaced {n}.")
with open(INDEX, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(new_html)
print("Rebuilt main table:", len(ROWS), "rows")
