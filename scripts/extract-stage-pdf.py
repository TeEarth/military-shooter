"""
v11 #2: extracts precise (x, y) positions from the user's stage-layout PDF
("แผนผัง Stage 1-10 , Stage Farm.pdf") for every player-spawn point, enemy
marker, and cover-object icon, across all 10 story stages + the farm stage.

The PDF's icons are embedded raster images (not vector shapes) placed via a
simple content-stream "cm ... /ImageN Do" transform, while the numbered
enemy markers (1-5, per the legend page) and the player-start dot are true
vector-drawn circles with a distinct fill color:
  - orange fill (1.0, 0.753, 0.0) = enemy marker, paired with a "1"-"5" text
    span at the same position (legend: 1=Pistol, 2=AK47, 3=Shotgun,
    4=Sniper, 5=Rocket)
  - green fill (0.439, 0.678, 0.278) = player start / "jud roem tonn"

Cover-object icon TYPE (tree/crate/sandbag/tent/house/wall) is classified
from each image's HSV hue/saturation fingerprint (measured once against a
known reference of each icon) rather than raw RGB, since brown (crate) and
tan (sandbag) otherwise overlap too much in plain RGB averages:
  - wall:      near-zero saturation everywhere (gray brick)
  - house:     high hue STDEV (bimodal - tan wall + red roof in one icon)
  - crate:     low hue (~0.08), high saturation, square aspect
  - sandbag:   low hue (~0.11, slightly higher than crate), lower
               saturation, wide aspect (>1.25)
  - tent:      higher hue (~0.20-0.25), wide aspect (>1.05)
  - tree:      higher hue (~0.25-0.3), square aspect

Run with: python3 scripts/extract-stage-pdf.py > scripts/data/stage-layout-raw.json
Requires: PyMuPDF (fitz), Pillow — both already available in this environment.
"""
import fitz
import io
import json
import re
import colorsys
import statistics
from PIL import Image

PDF_PATH = r"C:\Users\Asus\OneDrive\เดสก์ท็อป\เเผนผัง Stage 1-10 , Stage Farm.pdf"

# 0-indexed pages for each stage's DIAGRAM (odd 1-indexed pages after the legend;
# even 1-indexed pages in between are flavor-text description slides, unused here).
STAGE_PAGES = {
    "stage01": 1, "stage02": 3, "stage03": 5, "stage04": 7, "stage05": 9,
    "stage06": 11, "stage07": 13, "stage08": 15, "stage09": 17, "stage10": 19,
    "farm": 21,
}

ORANGE = (1.0, 0.7529410123825073, 0.0)
GREEN = (0.4392159879207611, 0.67843097448349, 0.2784309983253479)


def classify_icon(img_bytes, w, h):
    im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    pixels = im.getdata()

    all_sats = []
    saturated_hues = []
    for (pr, pg, pb) in pixels:
        if pr > 240 and pg > 240 and pb > 240:
            continue  # near-white background
        hue, sat, _val = colorsys.rgb_to_hsv(pr / 255, pg / 255, pb / 255)
        all_sats.append(sat)
        if sat >= 0.15:
            saturated_hues.append(hue)

    if not all_sats:
        return "unknown"

    aspect = w / h if h else 1
    overall_sat = sum(all_sats) / len(all_sats)

    if overall_sat < 0.15:
        return "wall"
    if not saturated_hues:
        return "unknown"

    avg_hue = sum(saturated_hues) / len(saturated_hues)
    hue_stdev = statistics.pstdev(saturated_hues)

    if hue_stdev > 0.06:
        return "house"
    if avg_hue < 0.15:
        return "sandbag" if aspect > 1.25 else "crate"
    return "camp_tent" if aspect > 1.05 else "tree"


def extract_page(doc, page_idx):
    page = doc[page_idx]

    # --- vector-drawn circles: enemy markers (orange) + player start (green) ---
    drawings = page.get_drawings()
    enemies = []
    player_start = None
    for d in drawings:
        fill = d.get("fill")
        rect = d.get("rect")
        if fill is None or rect is None:
            continue
        cx, cy = (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2
        if all(abs(fill[i] - ORANGE[i]) < 0.05 for i in range(3)):
            enemies.append({"cx": cx, "cy": cy, "rect": rect})
        elif all(abs(fill[i] - GREEN[i]) < 0.05 for i in range(3)):
            player_start = {"cx": cx, "cy": cy}

    # match each enemy circle to its number label (text span overlapping the rect)
    text_dict = page.get_text("dict")
    spans = []
    for block in text_dict.get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                txt = span["text"].strip()
                if re.fullmatch(r"[1-5]", txt):
                    bbox = span["bbox"]
                    scx, scy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
                    spans.append((scx, scy, txt))

    for e in enemies:
        best = None
        best_d = 1e9
        for scx, scy, txt in spans:
            dist = (scx - e["cx"]) ** 2 + (scy - e["cy"]) ** 2
            if dist < best_d:
                best_d = dist
                best = txt
        e["weaponNum"] = int(best) if best is not None and best_d < 400 else None

    # --- raster icons (cover objects) ---
    xref = page.xref
    res_ref = doc.xref_get_key(xref, "Resources")[1]  # e.g. "45 0 R"
    res_xref = int(res_ref.split()[0])
    res_obj = doc.xref_object(res_xref, compressed=True)
    m = re.search(r"/XObject<<(.*?)>>", res_obj)
    covers = []
    if m:
        xobj_entries = re.findall(r"/(\w+)\s+(\d+)\s+0\s+R", m.group(1))
        for name, xr in xobj_entries:
            xr = int(xr)
            subtype = doc.xref_get_key(xr, "Subtype")
            if subtype[1] != "/Image":
                continue
            rects = page.get_image_rects(xr)
            if not rects:
                continue
            rect = rects[0]
            w, h = rect.width, rect.height
            try:
                info = doc.extract_image(xr)
                icon_type = classify_icon(info["image"], w, h)
            except Exception:
                icon_type = "unknown"
            cx, cy = (rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2
            covers.append({"cx": cx, "cy": cy, "type": icon_type, "w": w, "h": h})

    return {
        "page_rect": [page.rect.width, page.rect.height],
        "player_start": player_start,
        "enemies": [{"cx": e["cx"], "cy": e["cy"], "weaponNum": e["weaponNum"]} for e in enemies],
        "covers": covers,
    }


def main():
    doc = fitz.open(PDF_PATH)
    result = {}
    for stage_id, page_idx in STAGE_PAGES.items():
        result[stage_id] = extract_page(doc, page_idx)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
