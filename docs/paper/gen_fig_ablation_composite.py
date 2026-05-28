#!/usr/bin/env python3
"""Generate composite ablation figures from the completed benchmark JSON."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / "packages/server/benchmark/reports/composite-ablation-2026-05-27T07-40-30-051Z-completed.json"
OUT_DIR = Path(__file__).resolve().parent / "figures"
OUT = OUT_DIR / "fig3-10-composite-ablation.png"


def main() -> None:
    data = json.loads(REPORT.read_text())
    rows = data["aggregate"]
    order = ["full", "no-rag", "no-critic", "no-debate", "minimal"]
    by_condition = {row["condition"]: row for row in rows}

    labels = ["Full", "No-RAG", "No-critic", "No-debate", "Minimal"]
    composite = [by_condition[c]["composite"] for c in order]
    evidence = [by_condition[c]["evidenceSupport"] for c in order]
    consistency = [by_condition[c]["consistency"] for c in order]
    repair = [by_condition[c]["repairQuality"] for c in order]

    colors = {
        "full": "#3D7AB0",
        "no-rag": "#C69045",
        "no-critic": "#7B6BB0",
        "no-debate": "#5A9B6E",
        "minimal": "#C97A6F",
    }
    fills = [colors[c] for c in order]

    fig, axes = plt.subplots(
        1,
        2,
        figsize=(12.5, 4.8),
        gridspec_kw={"width_ratios": [1.0, 1.55]},
    )
    fig.patch.set_facecolor("white")

    ax = axes[0]
    x = np.arange(len(order))
    bars = ax.bar(x, composite, color=fills, alpha=0.88, width=0.68)
    full_score = by_condition["full"]["composite"]
    ax.axhline(full_score, color="#222", linewidth=0.9, linestyle="--", alpha=0.45)
    for idx, (bar, score) in enumerate(zip(bars, composite)):
        delta = score - full_score
        label = f"{score:.2f}" if idx == 0 else f"{score:.2f}\n({delta:+.2f})"
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            score + 0.05,
            label,
            ha="center",
            va="bottom",
            fontsize=9,
            color="#222",
        )
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=25, ha="right", fontsize=9)
    ax.set_ylim(3.2, 4.8)
    ax.set_ylabel("Composite score (0-5)", fontsize=10)
    ax.set_title("Aggregate composite score", fontsize=11, fontfamily="serif", style="italic")
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    ax.set_axisbelow(True)

    ax = axes[1]
    metrics = {
        "Evidence": evidence,
        "Consistency": consistency,
        "Repair": repair,
    }
    width = 0.23
    offsets = [-width, 0, width]
    metric_colors = ["#8DB7D6", "#92BE91", "#D7A56D"]
    for offset, (metric, vals), color in zip(offsets, metrics.items(), metric_colors):
        ax.bar(x + offset, vals, width=width, label=metric, color=color, edgecolor="#555", linewidth=0.5)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=25, ha="right", fontsize=9)
    ax.set_ylim(0, 5.35)
    ax.set_ylabel("Subscore (0-5)", fontsize=10)
    ax.set_title("Mechanism-sensitive subscores", fontsize=11, fontfamily="serif", style="italic")
    ax.legend(frameon=False, loc="lower left", ncol=3, fontsize=8.8)
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    ax.set_axisbelow(True)

    for axis in axes:
        for side in ("top", "right"):
            axis.spines[side].set_visible(False)
        axis.spines["left"].set_color("#999")
        axis.spines["bottom"].set_color("#999")

    fig.suptitle(
        "Figure 3-10 · Composite design ablation with hidden conflict cases",
        fontsize=12.5,
        fontfamily="serif",
        style="italic",
        y=1.03,
    )
    fig.text(
        0.5,
        -0.02,
        "n = 6 cases · 2 normal + 4 hidden-conflict cases · Composite = 0.30 Coverage + 0.25 Evidence + 0.25 Consistency + 0.20 Repair",
        ha="center",
        fontsize=8.4,
        family="monospace",
        color="#555",
    )
    plt.tight_layout()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    plt.savefig(OUT, dpi=220, bbox_inches="tight", facecolor="white")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
