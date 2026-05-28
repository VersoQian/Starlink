#!/usr/bin/env python3
"""Generate Figure 3-1: Starlink progressive canvas construction overview.

This deterministic version avoids generated-image text artifacts and keeps the
terminology aligned with the thesis language:
- Progressive Canvas Construction is the main concept.
- Coverage is described as a supervisor coverage check, not as a named theory.
- Product-like wording such as "citation chips" is replaced by "citation markers".
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).parent / "figures" / "fig3-1-three-pillar.png"
W, H = 1600, 900
M = 48
PANEL_GAP = 24

BG = "#ffffff"
INK = "#1f2937"
MUTED = "#475569"
LINE = "#334155"
BLUE = "#eaf3fb"
BLUE_HEAD = "#466b91"
GREEN = "#eaf6ee"
GREEN_HEAD = "#4f7f5a"
PEACH = "#fff0df"
PEACH_HEAD = "#b8753d"
SOFT = "#f8fafc"
BOTTOM = "#f9fafb"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


F_TITLE = font(26, True)
F_HEAD = font(25, True)
F_BOX = font(19, True)
F_AGENT = font(18, True)
F_SMALL = font(15)
F_TINY = font(13)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def center_text(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], text: str, fnt, fill=INK) -> None:
    x1, y1, x2, y2 = box
    tw, th = text_size(draw, text, fnt)
    draw.text((x1 + (x2 - x1 - tw) / 2, y1 + (y2 - y1 - th) / 2 - 1), text, font=fnt, fill=fill)


def rounded(draw: ImageDraw.ImageDraw, box, fill=SOFT, outline=LINE, width=2, radius=8) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw: ImageDraw.ImageDraw, start, end, fill=LINE, width=2) -> None:
    x1, y1 = start
    x2, y2 = end
    draw.line((x1, y1, x2, y2), fill=fill, width=width)
    import math

    ang = math.atan2(y2 - y1, x2 - x1)
    size = 9
    pts = [
        (x2, y2),
        (x2 - size * math.cos(ang - 0.45), y2 - size * math.sin(ang - 0.45)),
        (x2 - size * math.cos(ang + 0.45), y2 - size * math.sin(ang + 0.45)),
    ]
    draw.polygon(pts, fill=fill)


def label_box(draw, box, text, fnt=F_BOX, fill=SOFT) -> None:
    rounded(draw, box, fill=fill, outline="#64748b", width=2, radius=7)
    lines = text.split("\n")
    total_h = sum(text_size(draw, line, fnt)[1] for line in lines) + (len(lines) - 1) * 6
    y = box[1] + (box[3] - box[1] - total_h) / 2 - 1
    for line in lines:
        tw, th = text_size(draw, line, fnt)
        draw.text((box[0] + (box[2] - box[0] - tw) / 2, y), line, font=fnt, fill=INK)
        y += th + 6


def panel(draw, box, title, head_color, fill) -> None:
    rounded(draw, box, fill=fill, outline="#334155", width=2, radius=9)
    x1, y1, x2, _ = box
    draw.rounded_rectangle((x1, y1, x2, y1 + 62), radius=9, fill=head_color, outline=head_color)
    draw.rectangle((x1, y1 + 45, x2, y1 + 62), fill=head_color)
    center_text(draw, (x1, y1, x2, y1 + 62), title, F_HEAD, "#ffffff")


def draw_reasoning(draw, box) -> None:
    x1, y1, x2, _ = box
    cx = (x1 + x2) // 2
    top = y1 + 95
    sup = (cx - 115, top, cx + 115, top + 58)
    label_box(draw, sup, "Supervisor\nrouter")
    agents = [
        (x1 + 28, top + 100, x1 + 158, top + 168, "Market\nagent"),
        (cx - 65, top + 100, cx + 65, top + 168, "Product\nagent"),
        (x2 - 158, top + 100, x2 - 28, top + 168, "Finance\nagent"),
    ]
    for ax1, ay1, ax2, ay2, text in agents:
        label_box(draw, (ax1, ay1, ax2, ay2), text, F_AGENT)
        arrow(draw, ((sup[0] + sup[2]) // 2, sup[3]), ((ax1 + ax2) // 2, ay1))
    bb = (x1 + 48, top + 210, x2 - 48, top + 270)
    label_box(draw, bb, "Shared blackboard", F_BOX)
    for ax1, ay1, ax2, ay2, _ in agents:
        arrow(draw, ((ax1 + ax2) // 2, ay2), ((ax1 + ax2) // 2, bb[1]))
    cs = (x1 + 95, top + 315, x2 - 95, top + 375)
    label_box(draw, cs, "Critic / Synthesizer")
    arrow(draw, (cx, bb[3]), (cx, cs[1]))
    cov = (x1 + 92, top + 420, x2 - 92, top + 492)
    label_box(draw, cov, "Supervisor coverage check\n(missing BMC cells)", F_SMALL)
    arrow(draw, (cx, cs[3]), (cx, cov[1]))


def draw_retrieval(draw, box) -> None:
    x1, y1, x2, _ = box
    cx = (x1 + x2) // 2
    top = y1 + 92
    kb = (cx - 130, top, cx + 130, top + 58)
    label_box(draw, kb, "Knowledge base")
    dense = (x1 + 36, top + 110, x1 + 205, top + 168)
    lex = (x2 - 205, top + 110, x2 - 36, top + 168)
    label_box(draw, dense, "Semantic\nretrieval", F_SMALL)
    label_box(draw, lex, "Lexical\nretrieval", F_SMALL)
    arrow(draw, (cx, kb[3]), ((dense[0] + dense[2]) // 2, dense[1]))
    arrow(draw, (cx, kb[3]), ((lex[0] + lex[2]) // 2, lex[1]))
    rrf = (cx - 115, top + 225, cx + 115, top + 282)
    label_box(draw, rrf, "RRF fusion")
    arrow(draw, ((dense[0] + dense[2]) // 2, dense[3]), (cx - 55, rrf[1]))
    arrow(draw, ((lex[0] + lex[2]) // 2, lex[3]), (cx + 55, rrf[1]))
    ev = (cx - 120, top + 340, cx + 120, top + 400)
    label_box(draw, ev, "Evidence chunks")
    arrow(draw, (cx, rrf[3]), (cx, ev[1]))
    cite = (cx - 120, top + 465, cx + 120, top + 525)
    label_box(draw, cite, "Citation markers")
    arrow(draw, (cx, ev[3]), (cx, cite[1]))


def draw_canvas(draw, box) -> None:
    x1, y1, x2, _ = box
    cx = (x1 + x2) // 2
    top = y1 + 95
    coach = (x1 + 55, top, x1 + 235, top + 60)
    cites = (x2 - 235, top, x2 - 55, top + 60)
    label_box(draw, coach, "Ideation\nCoach", F_SMALL)
    label_box(draw, cites, "Citation\nmarkers", F_SMALL)
    grid = (cx - 170, top + 130, cx + 170, top + 202)
    label_box(draw, grid, "9-cell BMC grid")
    arrow(draw, ((coach[0] + coach[2]) // 2, coach[3]), (cx - 80, grid[1]))
    arrow(draw, ((cites[0] + cites[2]) // 2, cites[3]), (cx + 80, grid[1]))
    detail = (x1 + 70, top + 270, x1 + 245, top + 330)
    edit = (x2 - 245, top + 270, x2 - 70, top + 330)
    label_box(draw, detail, "Cell detail\nview", F_SMALL)
    label_box(draw, edit, "User edits", F_SMALL)
    arrow(draw, (cx - 95, grid[3]), ((detail[0] + detail[2]) // 2, detail[1]))
    arrow(draw, ((detail[0] + detail[2]) // 2, detail[1]), (cx - 95, grid[3]))
    arrow(draw, (cx + 95, grid[3]), ((edit[0] + edit[2]) // 2, edit[1]))
    arrow(draw, ((edit[0] + edit[2]) // 2, edit[1]), (cx + 95, grid[3]))
    status = (cx - 150, top + 425, cx + 150, top + 495)
    label_box(draw, status, "Agent status\n(monitoring view)", F_SMALL)


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    title = "Starlink: Progressive Canvas Construction Overview"
    tw, _ = text_size(draw, title, F_TITLE)
    draw.text(((W - tw) / 2, 24), title, font=F_TITLE, fill=INK)

    panel_w = (W - 2 * M - 2 * PANEL_GAP) // 3
    panel_h = 620
    y = 78
    p1 = (M, y, M + panel_w, y + panel_h)
    p2 = (M + panel_w + PANEL_GAP, y, M + 2 * panel_w + PANEL_GAP, y + panel_h)
    p3 = (M + 2 * (panel_w + PANEL_GAP), y, W - M, y + panel_h)

    panel(draw, p1, "Multi-agent Reasoning Core", BLUE_HEAD, BLUE)
    panel(draw, p2, "Hybrid Evidence Retrieval", GREEN_HEAD, GREEN)
    panel(draw, p3, "Canvas Interface", PEACH_HEAD, PEACH)
    draw_reasoning(draw, p1)
    draw_retrieval(draw, p2)
    draw_canvas(draw, p3)

    # bottom flow
    by = 745
    b1 = (M, by, M + 410, by + 80)
    b2 = ((W - 410) // 2, by, (W + 410) // 2, by + 80)
    b3 = (W - M - 410, by, W - M, by + 80)
    for b, txt in [
        (b1, "Incomplete business idea"),
        (b2, "clarified context + evidence"),
        (b3, "evidence-backed canvas"),
    ]:
        rounded(draw, b, fill=BOTTOM, outline="#64748b", width=2, radius=7)
        center_text(draw, b, txt, F_BOX)
    arrow(draw, (b1[2], (b1[1] + b1[3]) // 2), (b2[0], (b2[1] + b2[3]) // 2))
    arrow(draw, (b2[2], (b2[1] + b2[3]) // 2), (b3[0], (b3[1] + b3[3]) // 2))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, quality=95, dpi=(300, 300))
    print(f"saved {OUT} {img.size}")


if __name__ == "__main__":
    main()
