#!/usr/bin/env python3
"""Generate Fig 3-9: Per-case YC results, head-to-head (Starlink vs gpt-solo)."""
import matplotlib.pyplot as plt
import numpy as np

cases = [
    "Stripe", "Airbnb", "Replit", "Pebble",
    "Coursera", "Notion", "Coinbase", "DoorDash",
    "Twitch", "Segment", "Brex", "Substack",
]
starlink = [20, 21, 19, 17, 20, 21, 21, 18, 20, 20, 21, 20]
gpt_solo = [21, 23, 19, 19, 18, 18, 18, 18, 20, 18, 16, 16]

# Per-dimension KP scores
kp_starlink = [2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 3, 2]
kp_gpt_solo = [0]*12

# Outcomes per case
outcome = []
for s, g in zip(starlink, gpt_solo):
    if s > g:
        outcome.append("WIN")
    elif s < g:
        outcome.append("base")
    else:
        outcome.append("tie")

# Palette (consistent with other figures)
COLOR_STARLINK = "#3D7AB0"   # blue
COLOR_GPTSOLO = "#C97A6F"    # red/clay
COLOR_KP_LINE = "#E8B04B"    # gold for KP highlight

fig, axes = plt.subplots(1, 2, figsize=(14, 5.0), gridspec_kw={"width_ratios": [2.2, 1.0]})
fig.patch.set_facecolor("white")

# --- Left panel: per-case grouped bars (Starlink vs gpt-solo) ---
ax = axes[0]
xs = np.arange(len(cases))
bar_w = 0.36

bars_s = ax.bar(xs - bar_w/2, starlink, bar_w, color=COLOR_STARLINK,
                edgecolor="#1F4F8B", linewidth=0.8, label="Starlink")
bars_g = ax.bar(xs + bar_w/2, gpt_solo, bar_w, color=COLOR_GPTSOLO,
                edgecolor="#7F4540", linewidth=0.8, label="single-LLM baseline")

# Value labels on top
for x, v in zip(xs - bar_w/2, starlink):
    ax.text(x, v + 0.3, f"{v}", ha="center", va="bottom", fontsize=8.5, color="#1F4F8B", fontweight="bold")
for x, v in zip(xs + bar_w/2, gpt_solo):
    ax.text(x, v + 0.3, f"{v}", ha="center", va="bottom", fontsize=8.5, color="#7F4540", fontweight="bold")

# Outcome markers (* for baseline wins) above the pair
for i, (o, s, g) in enumerate(zip(outcome, starlink, gpt_solo)):
    top = max(s, g) + 1.6
    if o == "base":
        ax.text(i, top, "★", ha="center", va="bottom", fontsize=12, color="#7F4540")

ax.set_xticks(xs)
ax.set_xticklabels(cases, fontsize=9.5, rotation=30, ha="right")
ax.set_ylabel("Agent-as-Judge total (out of 27)", fontsize=10.5)
ax.set_ylim(0, 27)
ax.set_title("Per-case head-to-head", fontsize=11.5, pad=10, fontfamily="serif", style="italic")
ax.grid(axis="y", linestyle=":", alpha=0.35)
ax.set_axisbelow(True)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.spines["left"].set_color("#888")
ax.spines["bottom"].set_color("#888")

# Mean reference lines
ax.axhline(np.mean(starlink), color=COLOR_STARLINK, linestyle="--", linewidth=0.7, alpha=0.55)
ax.axhline(np.mean(gpt_solo), color=COLOR_GPTSOLO, linestyle="--", linewidth=0.7, alpha=0.55)
ax.text(len(cases) - 0.4, np.mean(starlink) + 0.2, f"Starlink μ = {np.mean(starlink):.1f}",
        ha="right", va="bottom", fontsize=8, color=COLOR_STARLINK, family="monospace")
ax.text(len(cases) - 0.4, np.mean(gpt_solo) - 0.9, f"baseline μ = {np.mean(gpt_solo):.1f}",
        ha="right", va="top", fontsize=8, color=COLOR_GPTSOLO, family="monospace")

ax.legend(loc="lower right", frameon=False, fontsize=9)

# Footnote
ax.text(0.005, -0.21, "★ = baseline-win case (3 of 12); all three occur where baseline coverage was already saturated",
        transform=ax.transAxes, fontsize=8, color="#555", family="monospace")

# --- Right panel: KEY_PARTNERSHIPS per-case bars (0-3 scale) ---
ax2 = axes[1]
xs2 = np.arange(len(cases))
bar_w2 = 0.4

ax2.bar(xs2 - bar_w2/2, kp_starlink, bar_w2, color=COLOR_STARLINK,
        edgecolor="#1F4F8B", linewidth=0.8, label="Starlink")
ax2.bar(xs2 + bar_w2/2, kp_gpt_solo, bar_w2, color=COLOR_GPTSOLO,
        edgecolor="#7F4540", linewidth=0.8, label="single-LLM baseline")

for x, v in zip(xs2 - bar_w2/2, kp_starlink):
    if v > 0:
        ax2.text(x, v + 0.06, f"{v}", ha="center", va="bottom", fontsize=8, color="#1F4F8B", fontweight="bold")

ax2.set_xticks(xs2)
ax2.set_xticklabels(cases, fontsize=8.5, rotation=30, ha="right")
ax2.set_ylabel("KEY_PARTNERSHIPS score (0–3)", fontsize=10)
ax2.set_ylim(0, 3.5)
ax2.set_yticks([0, 1, 2, 3])
ax2.set_title("KEY_PARTNERSHIPS dimension", fontsize=11.5, pad=10, fontfamily="serif", style="italic")
ax2.grid(axis="y", linestyle=":", alpha=0.35)
ax2.set_axisbelow(True)
for s in ("top", "right"): ax2.spines[s].set_visible(False)
ax2.spines["left"].set_color("#888")
ax2.spines["bottom"].set_color("#888")

ax2.text(0.5, 0.5,
         "12 / 12 baseline = 0\n12 / 12 Starlink ≥ 1",
         transform=ax2.transAxes, ha="center", va="center",
         fontsize=10, color="#444",
         bbox=dict(boxstyle="round,pad=0.4", fc="#FFFEF2", ec="#E8B04B", lw=1.0))

fig.suptitle("Figure 3-9 · Per-case YC results (n = 12, Agent-as-Judge protocol, judge held constant)",
             fontsize=12.5, fontfamily="serif", style="italic", y=1.01)

plt.tight_layout()
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-9-per-case.png"
plt.savefig(out, dpi=200, bbox_inches="tight", facecolor="white")
print(f"Saved: {out}")
