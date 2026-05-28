#!/usr/bin/env python3
"""Generate Fig 3-9: Five-condition ablation bar chart (matplotlib, pastel style)."""
import matplotlib.pyplot as plt
import numpy as np

# Per-case scores out of 27, ordered: stripe, airbnb, replit, notion, brex, substack
data = {
    "minimal":   [24, 21, 20, 20, 21, 20],
    "no-RAG":    [24, 20, 20, 23, 20, 20],
    "full":      [23, 21, 21, 23, 23, 20],
    "no-debate": [24, 23, 22, 22, 20, 21],
    "no-critic": [24, 23, 21, 21, 24, 20],
}
cases = ["Stripe", "Airbnb", "Replit", "Notion", "Brex", "Substack"]
conds = list(data.keys())
means = {k: np.mean(v) for k, v in data.items()}

# Pastel palette aligned with other figures
colors = {
    "minimal":   "#FAE3E0",   # pale red    -- worst
    "no-RAG":    "#FCEDD7",   # pale amber
    "full":      "#E3F0FA",   # pale blue
    "no-debate": "#E6F2E7",   # pale green
    "no-critic": "#E6F2E7",   # pale green
}
edges = {
    "minimal":   "#C97A6F",
    "no-RAG":    "#C69045",
    "full":      "#3D7AB0",
    "no-debate": "#5A9B6E",
    "no-critic": "#5A9B6E",
}

fig, axes = plt.subplots(1, 2, figsize=(13, 5.0), gridspec_kw={"width_ratios": [1.1, 2.0]})
fig.patch.set_facecolor("white")

# --- Left panel: mean scores ---
ax1 = axes[0]
xs = np.arange(len(conds))
heights = [means[c] for c in conds]
bar_colors = [colors[c] for c in conds]
bar_edges = [edges[c] for c in conds]

bars = ax1.bar(xs, heights, color=bar_colors, edgecolor=bar_edges, linewidth=1.4, width=0.65)
for x, h in zip(xs, heights):
    ax1.text(x, h + 0.12, f"{h:.2f}", ha="center", va="bottom",
             fontsize=10, fontweight="bold", color="#222")

ax1.set_xticks(xs)
ax1.set_xticklabels(conds, fontsize=10, rotation=0)
ax1.set_ylim(19.5, 23.0)
ax1.set_ylabel("Mean score (out of 27)", fontsize=10.5)
ax1.set_title("Mean across 6 cases", fontsize=11.5, pad=10, fontfamily="serif", style="italic")
ax1.grid(axis="y", linestyle=":", alpha=0.35)
ax1.set_axisbelow(True)
for s in ("top", "right"):
    ax1.spines[s].set_visible(False)
ax1.spines["left"].set_color("#888")
ax1.spines["bottom"].set_color("#888")

# Horizontal reference line at full mean
full_mean = means["full"]
ax1.axhline(full_mean, color="#3D7AB0", linestyle="--", linewidth=0.8, alpha=0.5)
ax1.text(len(conds) - 0.45, full_mean + 0.04, f"full = {full_mean:.2f}",
         fontsize=8.5, color="#3D7AB0", ha="right", va="bottom",
         family="monospace")

# --- Right panel: per-case grouped bars ---
ax2 = axes[1]
n_cases = len(cases)
n_conds = len(conds)
bar_w = 0.15
group_x = np.arange(n_cases)

for i, cond in enumerate(conds):
    offsets = group_x + (i - (n_conds - 1) / 2) * bar_w
    ax2.bar(offsets, data[cond], width=bar_w,
            color=colors[cond], edgecolor=edges[cond],
            linewidth=0.9, label=cond)

ax2.set_xticks(group_x)
ax2.set_xticklabels(cases, fontsize=10)
ax2.set_ylim(18, 25.5)
ax2.set_ylabel("Score (out of 27)", fontsize=10.5)
ax2.set_title("Per-case scores", fontsize=11.5, pad=10, fontfamily="serif", style="italic")
ax2.grid(axis="y", linestyle=":", alpha=0.35)
ax2.set_axisbelow(True)
for s in ("top", "right"):
    ax2.spines[s].set_visible(False)
ax2.spines["left"].set_color("#888")
ax2.spines["bottom"].set_color("#888")
ax2.legend(loc="upper right", frameon=False, fontsize=9, ncol=5,
           bbox_to_anchor=(1.0, 1.0), columnspacing=1.0, handlelength=1.2)

fig.suptitle("Figure 3-10 · Five-condition design ablation on the YC validator set (n = 6)",
             fontsize=12.5, fontfamily="serif", style="italic", y=1.00)
fig.text(0.5, -0.02,
         "v4-flash on direct-vendor route · judge held constant · 0–3 per dimension × 9 dimensions",
         ha="center", fontsize=8.5, family="monospace", color="#555")

plt.tight_layout()
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-10-ablation.png"
plt.savefig(out, dpi=200, bbox_inches="tight", facecolor="white")
print(f"Saved: {out}")
