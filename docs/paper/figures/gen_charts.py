"""Generate two experiment figures for Starlink §3.5:
  1. fig-coverage-heatmap.png — Per-dimension empty-cell prevalence across configurations
  2. fig-ablation-bars.png    — Five-condition ablation, mean ± std horizontal bars

Data sources: Table 3-7, 3-8, 3-9 (cross-vendor + same-LLM control) and §3.5.6 table.

Run:
  python3 figures/gen_charts.py
"""
from __future__ import annotations

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from pathlib import Path

# ---------- shared style ----------
plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.titlesize": 11,
    "axes.labelsize": 10,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "figure.dpi": 160,
    "savefig.dpi": 220,
    "savefig.bbox": "tight",
    "savefig.facecolor": "white",
})
PASTEL_BLUE   = "#5b86b8"
PASTEL_AMBER  = "#d9a44a"
PASTEL_GREEN  = "#7fa982"
PASTEL_GREY   = "#b8b8b8"
LIGHT_BG      = "#f4f1ec"
DARK_INK      = "#2b2b2b"

OUT = Path(__file__).parent

# ============================================================
# Figure 1 — Cross-vendor coverage blind-spot heatmap
# ============================================================
# Each cell: fraction of cases where this BMC dimension was EMPTY (judge score = 0)
# Data from Table 3-8 ("KP = 0" column, "Other empty-cell prevalence" column)
# and from the §3.5.3 narrative on MiniMax-M2.5.
#
# Column order = BMC template order. KP is intentionally the tail slot.
BMC_COLS = ["CS", "VP", "CH", "CR", "RS", "KR", "KA", "KP", "CO"]

# rows: (label, n_cases, per-dim empty-fraction)
configs = [
    ("Single-LLM baseline\n(primary, n=12)",         12, [0, 0, 0,    0, 0, 0,    0,    1.00, 0]),
    ("Single-LLM baseline\n(DeepSeek-class, n=12)",  12, [0, 0, 0,    0, 0, 0,    0,    0.92, 0]),
    ("Single-LLM baseline\n(MiniMax-A, n=12)",       12, [0, 0, 0.42, 0, 0, 0.42, 0.83, 1.00, 0]),
    ("Single-LLM baseline\n(MiniMax-B, n=6)",         6, [0, 0, 0.25, 0, 0, 0.25, 0.30, 1.00, 0]),
    ("Same-LLM control,\nmulti-agent (n=6)",          6, [0]*9),
    ("Starlink (full, n=12)",                        12, [0]*9),
]

mat = np.array([row[2] for row in configs])
row_labels = [row[0] for row in configs]

fig, ax = plt.subplots(figsize=(9.5, 4.2))

# Custom diverging-ish colormap: grey for 0, amber → deep amber for higher
from matplotlib.colors import LinearSegmentedColormap
cmap = LinearSegmentedColormap.from_list(
    "blindspot",
    [(0.0, "#ffffff"), (0.05, "#f0ede7"), (0.5, "#e8b96b"), (1.0, "#a85a2a")],
    N=256,
)

im = ax.imshow(mat, cmap=cmap, vmin=0, vmax=1, aspect="auto")

# Annotate each cell
for i in range(mat.shape[0]):
    for j in range(mat.shape[1]):
        v = mat[i, j]
        if v == 0:
            txt = "·"
            color = "#888888"
        else:
            txt = f"{int(v*100)}%"
            color = "white" if v > 0.5 else "#3a2a14"
        ax.text(j, i, txt, ha="center", va="center", fontsize=8.5, color=color)

# KP column highlight
kp_idx = BMC_COLS.index("KP")
ax.add_patch(Rectangle((kp_idx-0.5, -0.5), 1, mat.shape[0],
                       fill=False, edgecolor=DARK_INK, lw=1.6, zorder=5))

ax.set_xticks(range(len(BMC_COLS)))
ax.set_xticklabels(BMC_COLS, fontweight="bold")
ax.set_yticks(range(len(row_labels)))
ax.set_yticklabels(row_labels)
ax.set_xlabel("BMC dimension (template order →)", labelpad=8)
ax.tick_params(axis="x", length=0)
ax.tick_params(axis="y", length=0)

# Colorbar
cbar = fig.colorbar(im, ax=ax, fraction=0.024, pad=0.02)
cbar.set_label("fraction of cases with empty cell", fontsize=9)
cbar.outline.set_visible(False)

# Annotation arrow under KP
ax.annotate("structural blind spot (template tail)",
            xy=(kp_idx, len(row_labels)-0.5), xytext=(kp_idx, len(row_labels)+0.8),
            ha="center", fontsize=9, color=DARK_INK, fontstyle="italic",
            arrowprops=dict(arrowstyle="->", lw=1, color=DARK_INK))

plt.savefig(OUT / "fig-coverage-heatmap.png")
print(f"wrote {OUT / 'fig-coverage-heatmap.png'}")
plt.close(fig)

# ============================================================
# Figure 2 — Five-condition ablation horizontal bars
# ============================================================
# Per-case scores from §3.5.6 table:
cases   = ["Stripe", "Airbnb", "Replit", "Notion", "Brex", "Substack"]
conditions = {
    "minimal":   [24, 21, 20, 20, 21, 20],
    "no-RAG":    [24, 20, 20, 23, 20, 20],
    "full":      [23, 21, 21, 23, 23, 20],
    "no-debate": [24, 23, 22, 22, 20, 21],
    "no-critic": [24, 23, 21, 21, 24, 20],
}
means = {k: np.mean(v) for k, v in conditions.items()}
stds  = {k: np.std(v, ddof=1) for k, v in conditions.items()}

# Sort ascending by mean so the worst is at top, best at bottom
order = sorted(conditions, key=lambda k: means[k])
labels = order
ms = [means[k] for k in order]
ss = [stds[k]  for k in order]

# Highlight no-RAG (load-bearing channel) in amber, full in deep blue, others in pale grey-blue
def _color(k):
    if k == "no-RAG":   return PASTEL_AMBER
    if k == "full":     return PASTEL_BLUE
    return "#d0d4dc"

fig, ax = plt.subplots(figsize=(8.8, 3.8))
y = np.arange(len(labels))
bars = ax.barh(y, ms, xerr=ss, color=[_color(k) for k in labels],
               edgecolor=DARK_INK, linewidth=0.7,
               error_kw=dict(ecolor=DARK_INK, capsize=4, capthick=0.8, elinewidth=0.8),
               height=0.62)

# Value labels at end of bar
for yi, (m, s, k) in enumerate(zip(ms, ss, labels)):
    ax.text(m + s + 0.05, yi, f"{m:.2f} ± {s:.2f}",
            va="center", ha="left", fontsize=9, color=DARK_INK)

# Reference line at "full" mean
full_mean = means["full"]
ax.axvline(full_mean, color=PASTEL_BLUE, lw=0.9, ls="--", alpha=0.55, zorder=0)
ax.text(full_mean, len(labels)-0.4, " full baseline", fontsize=8.5,
        color=PASTEL_BLUE, va="bottom", ha="left")

ax.set_yticks(y)
ax.set_yticklabels(labels, fontweight="bold")
ax.set_xlabel("Mean rubric score (out of 27, n=6 YC validator cases)", labelpad=8)
ax.set_xlim(19.5, 23.5)   # focused range — full 0-axis would magnify-to-zero the differences
ax.spines["left"].set_color("#ccc")
ax.spines["bottom"].set_color("#ccc")
ax.grid(axis="x", color="#eee", lw=0.6, zorder=0)
ax.set_axisbelow(True)

plt.savefig(OUT / "fig-ablation-bars.png")
print(f"wrote {OUT / 'fig-ablation-bars.png'}")
plt.close(fig)
