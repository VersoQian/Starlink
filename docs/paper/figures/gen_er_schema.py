from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).with_name("fig4-1-er.png")
W, H = 2400, 1500
S = 2


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size * S, index=index)


FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf"
FONT_TITLE = "/System/Library/Fonts/Supplemental/Times New Roman Bold Italic.ttf"

TITLE = font(FONT_TITLE, 34)
DOMAIN = font(FONT_REG, 18)
DOMAIN_I = font(FONT_ITALIC, 18)
HEADER = font(FONT_BOLD, 18)
FIELD = font(FONT_REG, 16)
FIELD_B = font(FONT_BOLD, 16)
PK = font(FONT_BOLD, 16)
LABEL = font(FONT_REG, 15)
FOOT = font(FONT_REG, 17)


def sc(v: int) -> int:
    return v * S


def rounded(draw: ImageDraw.ImageDraw, box, radius, fill, outline, width=2, dash=None):
    box = tuple(sc(int(x)) for x in box)
    radius = sc(radius)
    width = sc(width)
    if dash:
        draw.rounded_rectangle(box, radius=radius, fill=fill)
        dashed_round_rect(draw, box, radius, outline, width, dash)
    else:
        draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def dashed_line(draw, p1, p2, fill, width=2, dash=(10, 7)):
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    dist = (dx * dx + dy * dy) ** 0.5
    if dist == 0:
        return
    ux, uy = dx / dist, dy / dist
    pos = 0
    while pos < dist:
        end = min(pos + dash[0] * S, dist)
        draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * end, y1 + uy * end), fill=fill, width=width)
        pos += (dash[0] + dash[1]) * S


def dashed_round_rect(draw, box, radius, fill, width, dash=(10, 8)):
    x1, y1, x2, y2 = box
    # A lightweight dashed outline: dashed straight sides plus solid corner arcs.
    dashed_line(draw, (x1 + radius, y1), (x2 - radius, y1), fill, width, dash)
    dashed_line(draw, (x1 + radius, y2), (x2 - radius, y2), fill, width, dash)
    dashed_line(draw, (x1, y1 + radius), (x1, y2 - radius), fill, width, dash)
    dashed_line(draw, (x2, y1 + radius), (x2, y2 - radius), fill, width, dash)
    for start, end, bb in [
        (180, 270, (x1, y1, x1 + 2 * radius, y1 + 2 * radius)),
        (270, 360, (x2 - 2 * radius, y1, x2, y1 + 2 * radius)),
        (0, 90, (x2 - 2 * radius, y2 - 2 * radius, x2, y2)),
        (90, 180, (x1, y2 - 2 * radius, x1 + 2 * radius, y2)),
    ]:
        draw.arc(bb, start=start, end=end, fill=fill, width=width)


def text(draw, xy, s, fnt, fill="#111827", anchor=None):
    draw.text((sc(xy[0]), sc(xy[1])), s, font=fnt, fill=fill, anchor=anchor)


def centered(draw, box, s, fnt, fill="#111827"):
    x1, y1, x2, y2 = box
    draw.text((sc((x1 + x2) // 2), sc((y1 + y2) // 2)), s, font=fnt, fill=fill, anchor="mm")


@dataclass
class TableBox:
    name: str
    x: int
    y: int
    w: int
    fields: list[tuple[str, str]]
    color: str
    edge: str

    @property
    def h(self) -> int:
        return 52 + 32 * len(self.fields) + 16

    @property
    def box(self):
        return (self.x, self.y, self.x + self.w, self.y + self.h)

    def anchor(self, side: str):
        x1, y1, x2, y2 = self.box
        return {
            "top": ((x1 + x2) // 2, y1),
            "bottom": ((x1 + x2) // 2, y2),
            "left": (x1, (y1 + y2) // 2),
            "right": (x2, (y1 + y2) // 2),
        }[side]


def draw_table(draw, t: TableBox):
    rounded(draw, t.box, 12, "#ffffff", t.edge, width=2)
    rounded(draw, (t.x, t.y, t.x + t.w, t.y + 44), 12, t.color, t.edge, width=2)
    # Cover lower rounded header outline, leaving a clean rectangular seam.
    draw.rectangle((sc(t.x + 1), sc(t.y + 28), sc(t.x + t.w - 1), sc(t.y + 45)), fill=t.color)
    draw.line((sc(t.x), sc(t.y + 44), sc(t.x + t.w), sc(t.y + 44)), fill=t.edge, width=sc(2))
    centered(draw, (t.x, t.y, t.x + t.w, t.y + 44), t.name, HEADER)
    y = t.y + 62
    for label, kind in t.fields:
        f = PK if kind in {"pk", "fk"} else FIELD
        fill = "#9f1239" if kind == "pk" else "#1f2937"
        text(draw, (t.x + 24, y), label, f, fill=fill)
        y += 32


def arrow(draw, start, end, fill="#64748b", width=3, dashed=False, label=None, label_offset=(0, 0)):
    p1 = (sc(start[0]), sc(start[1]))
    p2 = (sc(end[0]), sc(end[1]))
    if dashed:
        dashed_line(draw, p1, p2, fill, width=sc(width), dash=(10, 7))
    else:
        draw.line((*p1, *p2), fill=fill, width=sc(width))
    # simple arrow head
    import math

    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    size = sc(11)
    a1 = ang + math.pi * 0.84
    a2 = ang - math.pi * 0.84
    pts = [
        p2,
        (p2[0] + size * math.cos(a1), p2[1] + size * math.sin(a1)),
        (p2[0] + size * math.cos(a2), p2[1] + size * math.sin(a2)),
    ]
    draw.polygon(pts, fill=fill)
    if label:
        mx = (start[0] + end[0]) // 2 + label_offset[0]
        my = (start[1] + end[1]) // 2 + label_offset[1]
        pad = 8
        bb = draw.textbbox((sc(mx), sc(my)), label, font=LABEL, anchor="mm")
        draw.rounded_rectangle(
            (bb[0] - sc(pad), bb[1] - sc(4), bb[2] + sc(pad), bb[3] + sc(4)),
            radius=sc(7),
            fill="#ffffff",
            outline="#e5e7eb",
            width=sc(1),
        )
        draw.text((sc(mx), sc(my)), label, font=LABEL, fill="#334155", anchor="mm")


def poly_arrow(draw, points, fill="#64748b", width=3, dashed=False, label=None, label_at=0.5, label_offset=(0, 0)):
    scaled = [(sc(x), sc(y)) for x, y in points]
    for p1, p2 in zip(scaled, scaled[1:]):
        if dashed:
            dashed_line(draw, p1, p2, fill, width=sc(width), dash=(10, 7))
        else:
            draw.line((*p1, *p2), fill=fill, width=sc(width))

    import math

    p1 = scaled[-2]
    p2 = scaled[-1]
    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    size = sc(11)
    a1 = ang + math.pi * 0.84
    a2 = ang - math.pi * 0.84
    draw.polygon(
        [
            p2,
            (p2[0] + size * math.cos(a1), p2[1] + size * math.sin(a1)),
            (p2[0] + size * math.cos(a2), p2[1] + size * math.sin(a2)),
        ],
        fill=fill,
    )

    if label:
        # Place label on the longest segment unless a fractional position is supplied.
        segs = []
        total = 0.0
        for a, b in zip(points, points[1:]):
            length = ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
            segs.append((a, b, length))
            total += length
        target = total * label_at
        acc = 0.0
        lx, ly = points[len(points) // 2]
        for a, b, length in segs:
            if acc + length >= target and length:
                r = (target - acc) / length
                lx = a[0] + (b[0] - a[0]) * r
                ly = a[1] + (b[1] - a[1]) * r
                break
            acc += length
        lx += label_offset[0]
        ly += label_offset[1]
        pad = 8
        bb = draw.textbbox((sc(lx), sc(ly)), label, font=LABEL, anchor="mm")
        draw.rounded_rectangle(
            (bb[0] - sc(pad), bb[1] - sc(4), bb[2] + sc(pad), bb[3] + sc(4)),
            radius=sc(7),
            fill="#ffffff",
            outline="#e5e7eb",
            width=sc(1),
        )
        draw.text((sc(lx), sc(ly)), label, font=LABEL, fill="#334155", anchor="mm")


def main():
    img = Image.new("RGB", (W * S, H * S), "#ffffff")
    draw = ImageDraw.Draw(img)

    centered(draw, (0, 22, W, 82), "Simplified ER View: Core Persistence Schema Across Three Functional Domains", TITLE)

    # Domain containers
    domains = [
        (34, 108, 820, 1328, "#eef7ff", "#8db6d8", "DOMAIN 1 · ", "Knowledge"),
        (865, 108, 1575, 1328, "#f0f9ef", "#93c48f", "DOMAIN 2 · ", "Conversation / Run"),
        (1615, 108, 2365, 1328, "#fff6dd", "#d7a642", "DOMAIN 3 · ", "Memory"),
    ]
    for x1, y1, x2, y2, fill, edge, prefix, italic in domains:
        rounded(draw, (x1, y1, x2, y2), 18, fill, edge, width=2, dash=(12, 8))
        centered(draw, (x1, y1 + 12, x2, y1 + 54), prefix, DOMAIN)
        px = (x1 + x2) // 2 + 56
        draw.text((sc(px), sc(y1 + 34)), italic, font=DOMAIN_I, fill="#111827", anchor="lm")
        draw.line((sc(x1 + 18), sc(y1 + 64), sc(x2 - 18), sc(y1 + 64)), fill=edge, width=sc(2))

    blue = ("#cfe5f7", "#7aa9cf")
    green = ("#d8efd3", "#87bf7f")
    amber = ("#f7dfa7", "#d09b2f")
    gray = ("#f3f4f6", "#b7bec8")

    kb = TableBox("knowledge_base", 74, 185, 285, [
        ("id PK", "pk"),
        ("name", ""),
        ("status", ""),
        ("created_at", ""),
    ], *blue)
    doc = TableBox("documents", 570, 300, 255, [
        ("id PK", "pk"),
        ("kb_id FK", "fk"),
        ("title", ""),
        ("path", ""),
        ("mime", ""),
        ("size", ""),
        ("metadata JSONB", ""),
    ], *blue)
    chunk = TableBox("vector_chunks", 485, 650, 330, [
        ("id PK", "pk"),
        ("kb_id FK", "fk"),
        ("document_id FK", "fk"),
        ("chunk_text", ""),
        ("embedding VECTOR(1536)", ""),
        ("source", ""),
    ], *blue)
    bind = TableBox("kb_agent_bindings", 74, 1002, 315, [
        ("id PK", "pk"),
        ("workspace_id", ""),
        ("kb_id FK", "fk"),
        ("agent_id", ""),
        ("auto_search", ""),
        ("created_at", ""),
    ], *gray)

    conv = TableBox("conversations", 985, 185, 325, [
        ("id PK", "pk"),
        ("workspace_id", ""),
        ("user_id", ""),
        ("title", ""),
        ("status", ""),
        ("current_run_id FK", "fk"),
        ("opened_at", ""),
        ("closed_at", ""),
    ], *green)
    run = TableBox("runs", 1118, 625, 365, [
        ("id PK", "pk"),
        ("conversation_id FK", "fk"),
        ("workspace_id", ""),
        ("status", ""),
        ("langgraph_thread_id", ""),
        ("hitl_directive JSONB", ""),
        ("context_snapshot JSONB", ""),
        ("started_at", ""),
    ], *green)
    msg = TableBox("conversation_messages", 1010, 1020, 350, [
        ("id PK", "pk"),
        ("conversation_id FK", "fk"),
        ("role", ""),
        ("content", ""),
        ("metadata", ""),
        ("created_at", ""),
    ], *green)
    mem = TableBox("memory_items", 1670, 480, 620, [
        ("id PK", "pk"),
        ("workspace_id", ""),
        ("user_id", ""),
        ("scope {session | workspace | user}", ""),
        ("kind {summary | decision | user-skill | insight | constraint}", ""),
        ("title", ""),
        ("content", ""),
        ("embedding VECTOR(1536)", ""),
        ("importance", ""),
        ("confidence", ""),
        ("last_used_at", ""),
        ("archived_at", ""),
    ], *amber)

    for table in [kb, doc, chunk, bind, conv, run, msg, mem]:
        draw_table(draw, table)

    # Link table container
    rounded(draw, (54, 950, 430, 1282), 16, "#ffffff", "#cbd5e1", width=2, dash=(11, 8))
    centered(draw, (54, 960, 430, 1010), "BINDING TABLE", DOMAIN)
    draw_table(draw, bind)

    # Relationships use elbowed routes through whitespace so no line crosses a table body.
    poly_arrow(
        draw,
        [kb.anchor("right"), (430, kb.anchor("right")[1]), (430, doc.anchor("left")[1]), doc.anchor("left")],
        label="contains",
        label_at=0.45,
        label_offset=(2, -18),
    )
    poly_arrow(
        draw,
        [doc.anchor("bottom"), (doc.anchor("bottom")[0], 602), (chunk.anchor("top")[0], 602), chunk.anchor("top")],
        label="splits into",
        label_at=0.46,
        label_offset=(30, -16),
    )
    poly_arrow(
        draw,
        [kb.anchor("bottom"), (kb.anchor("bottom")[0], 560), (455, 560), (455, chunk.anchor("left")[1]), chunk.anchor("left")],
        label="indexes",
        label_at=0.52,
        label_offset=(0, -16),
    )
    poly_arrow(
        draw,
        [(kb.x + 86, kb.y + kb.h), (kb.x + 86, 912), (bind.x + 86, 912), (bind.x + 86, bind.y)],
        label="bound to agents",
        label_at=0.45,
        label_offset=(70, -14),
    )

    poly_arrow(
        draw,
        [conv.anchor("bottom"), (conv.anchor("bottom")[0], 548), (run.anchor("top")[0], 548), run.anchor("top")],
        label="executes",
        label_at=0.50,
        label_offset=(44, -14),
    )
    poly_arrow(
        draw,
        [(conv.x + 48, conv.y + conv.h), (930, conv.y + conv.h), (930, msg.anchor("left")[1]), msg.anchor("left")],
        label="contains",
        label_at=0.60,
        label_offset=(-38, -14),
    )
    poly_arrow(
        draw,
        [(run.x + run.w, run.y + 58), (1538, run.y + 58), (1538, conv.y + conv.h - 42), (conv.x + conv.w, conv.y + conv.h - 42)],
        dashed=True,
        label="current_run_id",
        label_at=0.36,
        label_offset=(24, -16),
    )
    poly_arrow(
        draw,
        [mem.anchor("left"), (1588, mem.anchor("left")[1]), (1588, run.anchor("right")[1]), run.anchor("right")],
        dashed=True,
        label="source_id",
        label_at=0.45,
        label_offset=(0, -16),
    )

    # Cross-domain note arrow from KB to run context.
    poly_arrow(
        draw,
        [chunk.anchor("right"), (845, chunk.anchor("right")[1]), (845, run.y + 116), (run.x, run.y + 116)],
        dashed=True,
        label="retrieved evidence",
        label_at=0.58,
        label_offset=(0, -16),
    )

    # Legend
    lx, ly = 1698, 1112
    rounded(draw, (lx, ly, 2340, 1284), 14, "#ffffff", "#d1d5db", width=2)
    text(draw, (lx + 24, ly + 30), "Legend", FIELD_B)
    arrow(draw, (lx + 36, ly + 76), (lx + 160, ly + 76), width=3)
    text(draw, (lx + 178, ly + 66), "foreign-key relation", FIELD)
    arrow(draw, (lx + 36, ly + 120), (lx + 160, ly + 120), width=3, dashed=True)
    text(draw, (lx + 178, ly + 110), "derived reference or runtime link", FIELD)

    # Footer
    draw.line((sc(34), sc(1410), sc(2365), sc(1410)), fill="#d1d5db", width=sc(2))
    footer = (
        "All tenant-owned tables carry workspace_id for isolation under PostgreSQL Row-Level Security. "
        "Vector columns use pgvector for similarity search; memory links can reference the run that produced an item."
    )
    text(draw, (42, 1432), footer, FOOT, fill="#1f2937")

    img = img.resize((W, H), Image.Resampling.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, quality=98)
    print(OUT)


if __name__ == "__main__":
    main()
