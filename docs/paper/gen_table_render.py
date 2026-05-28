#!/usr/bin/env python3
"""Render LaTeX-booktabs-style tables as PNG using matplotlib.

Each table is rendered as a clean publication-quality image:
- Top rule (1.5pt) + mid rule (0.8pt) + bottom rule (1.5pt) = booktabs convention
- No vertical lines
- No row separators inside body
- Tabular numerals (right-aligned for numeric columns)
- JetBrains Mono for code, Inter/system-ui for prose
- Soft pastel highlight on the Starlink row (matching paper figures)
"""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import textwrap
import os

OUT_DIR = "/Users/sheng/git/video/Starlink/docs/paper/figures"

# Color palette (consistent with the paper's other figures)
COL_INK = "#222222"
COL_RULE = "#333333"
COL_SOFT = "#888888"
COL_STARLINK_BG = "#E6F2E7"  # pale green highlight for Starlink rows
COL_HEADER_BG = "#FAFAFA"


def render_table(
    headers,
    rows,
    out_filename,
    title=None,
    col_widths=None,  # relative widths, e.g. [1, 2, 1.5]
    highlight_row=None,  # 0-indexed row to highlight (Starlink etc.)
    col_aligns=None,  # 'l'/'c'/'r' per column; default 'l'
    cell_padding=(8, 6),  # (horizontal_px, vertical_px)
    font_size=10,
    header_font_size=10,
    figsize=None,
    wrap_chars=None,  # int or list — wrap cell text at this many chars (per col)
    note=None,  # optional bottom note (italic small)
    band_rows=None,  # dict {row_idx: "band label"}; rendered as full-width bold label
):
    """Render a single table as PNG."""
    n_cols = len(headers)
    n_rows = len(rows)

    # Default column widths
    if col_widths is None:
        col_widths = [1.0] * n_cols
    col_widths = list(col_widths)

    # Default alignment
    if col_aligns is None:
        col_aligns = ['l'] * n_cols

    # Wrap cells if requested
    def maybe_wrap(text, col_idx):
        if wrap_chars is None:
            return text
        w = wrap_chars[col_idx] if isinstance(wrap_chars, (list, tuple)) else wrap_chars
        if w is None or w <= 0:
            return text
        return "\n".join(textwrap.wrap(text, width=w)) if text else ""

    wrapped_rows = [[maybe_wrap(cell, c) for c, cell in enumerate(r)] for r in rows]
    wrapped_headers = [maybe_wrap(h, c) for c, h in enumerate(headers)]

    # Compute layout
    total_w = sum(col_widths)
    col_x_norm = [0.0]
    for w in col_widths:
        col_x_norm.append(col_x_norm[-1] + w / total_w)

    # Estimate row heights from line counts
    def line_count(t):
        return max(1, t.count("\n") + 1)
    header_lines = max(line_count(h) for h in wrapped_headers)
    row_lines = [max(line_count(c) for c in r) for r in wrapped_rows]

    line_h = 0.024  # in figure-relative units
    header_h = (header_lines * line_h) + 0.012
    row_heights = [(lc * line_h) + 0.008 for lc in row_lines]

    # Total figure height
    title_h = 0.04 if title else 0
    note_h = 0.025 if note else 0
    body_h = header_h + sum(row_heights)
    total_h = title_h + body_h + note_h + 0.04  # padding

    if figsize is None:
        # Width scales with col count and max cell length
        width_in = 9 + 0.4 * n_cols
        height_in = max(2.2, total_h * 14)  # heuristic
        figsize = (width_in, height_in)

    fig, ax = plt.subplots(figsize=figsize)
    fig.patch.set_facecolor("white")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, total_h)
    ax.axis("off")

    # Title
    y_cursor = total_h - 0.005
    if title:
        ax.text(0.5, y_cursor - title_h / 2, title,
                ha="center", va="center", fontsize=12,
                fontfamily="serif", style="italic", color=COL_INK)
        y_cursor -= title_h

    # Top rule
    ax.plot([0, 1], [y_cursor, y_cursor], color=COL_RULE, lw=1.6, solid_capstyle="butt")

    # Header row
    header_y_bottom = y_cursor - header_h
    for ci, htext in enumerate(wrapped_headers):
        x_left = col_x_norm[ci]
        x_right = col_x_norm[ci + 1]
        x_center = (x_left + x_right) / 2
        align = col_aligns[ci]
        if align == 'l':
            ha, tx = "left", x_left + 0.008
        elif align == 'r':
            ha, tx = "right", x_right - 0.008
        else:
            ha, tx = "center", x_center
        ax.text(tx, y_cursor - header_h / 2, htext,
                ha=ha, va="center",
                fontsize=header_font_size, fontweight="bold",
                fontfamily="sans-serif", color=COL_INK)
    y_cursor = header_y_bottom

    # Mid rule
    ax.plot([0, 1], [y_cursor, y_cursor], color=COL_RULE, lw=0.9, solid_capstyle="butt")

    # Body rows
    for ri, row in enumerate(wrapped_rows):
        row_h = row_heights[ri]
        row_y_bottom = y_cursor - row_h

        # Band header row — spans all columns as a single bold label with faint rule above
        if band_rows is not None and ri in band_rows:
            ax.add_patch(plt.Rectangle((0, row_y_bottom), 1, row_h,
                                       facecolor=COL_HEADER_BG, edgecolor='none', zorder=0))
            ax.plot([0, 1], [y_cursor, y_cursor], color=COL_SOFT, lw=0.4, solid_capstyle="butt")
            ax.text(0.008, y_cursor - row_h / 2, band_rows[ri],
                    ha="left", va="center",
                    fontsize=font_size, fontweight="bold",
                    fontfamily="sans-serif", color=COL_INK)
            y_cursor = row_y_bottom
            continue

        # Highlight row background if requested
        if highlight_row is not None and ri == highlight_row:
            ax.add_patch(plt.Rectangle((0, row_y_bottom), 1, row_h,
                                       facecolor=COL_STARLINK_BG, edgecolor='none', zorder=0))

        for ci, ctext in enumerate(row):
            x_left = col_x_norm[ci]
            x_right = col_x_norm[ci + 1]
            x_center = (x_left + x_right) / 2
            align = col_aligns[ci]
            if align == 'l':
                ha, tx = "left", x_left + 0.008
            elif align == 'r':
                ha, tx = "right", x_right - 0.008
            else:
                ha, tx = "center", x_center

            # Special: monospace for code-y content (contains backtick)
            is_code = ctext and ('`' in ctext or ctext.startswith('▪') or any(c in ctext for c in ['{}', '()', '=']))
            ff = "monospace" if is_code else "sans-serif"
            ctext_clean = ctext.replace('`', '')

            # Bold the highlight row first column
            is_bold = (highlight_row is not None and ri == highlight_row)

            ax.text(tx, y_cursor - row_h / 2, ctext_clean,
                    ha=ha, va="center",
                    fontsize=font_size,
                    fontfamily=ff,
                    fontweight="bold" if is_bold else "normal",
                    color=COL_INK)
        y_cursor = row_y_bottom

    # Bottom rule
    ax.plot([0, 1], [y_cursor, y_cursor], color=COL_RULE, lw=1.6, solid_capstyle="butt")

    # Note
    if note:
        y_cursor -= 0.005
        ax.text(0, y_cursor - note_h / 2, note,
                ha="left", va="center", fontsize=8.5,
                fontfamily="sans-serif", style="italic", color=COL_SOFT)

    plt.tight_layout(pad=0.5)
    out_path = os.path.join(OUT_DIR, out_filename)
    plt.savefig(out_path, dpi=200, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"Saved: {out_path} ({os.path.getsize(out_path)} bytes)")
    return out_path


# =====================================================================
# TABLE 2-1: Cross-framework comparison of multi-agent LLM systems
# =====================================================================

table_2_1 = {
    "headers": ["Framework", "Agent count", "Coordination", "Communication", "State model", "Output", "Coverage enforcement"],
    "rows": [
        ["CAMEL [25]",  "2 (role pair)",       "role-play dialogue",  "direct messages",     "per-agent prompt",        "text",                        "none — coverage emergent from dialogue"],
        ["AutoGen [26]","configurable",        "GroupChat",           "message queue",       "per-conversation",        "text + code",                 "group chat — depends on prompt design"],
        ["MetaGPT [27]","5 SOP roles",         "publish/subscribe",   "shared message pool", "per-role memory",         "code + design docs",          "Standardized Operating Procedures"],
        ["Magentic-One [28]","configurable",   "orchestrator + planner","direct",            "shared task ledger",      "task-specific",               "task ledger — orchestrator planning"],
    ],
    "col_widths": [1.0, 1.0, 1.4, 1.2, 1.3, 1.5, 2.1],
    "wrap_chars": [16, 12, 16, 14, 16, 18, 26],
    "title": "Table 2-1 · Cross-framework comparison of multi-agent LLM systems",
    "note": "Final column reports each framework's coverage-enforcement strategy — the axis along which they most clearly differ."
}

# =====================================================================
# TABLE 2-2: RAG regimes positioning
# =====================================================================

table_2_2 = {
    "headers": ["Approach", "Retrieval mode", "Fusion", "Multilingual", "Jitter behavior reported"],
    "rows": [
        ["Naive RAG",           "dense (vector) only",       "n/a",                       "partial",       "not reported"],
        ["Advanced RAG [32]",   "dense + rerank",            "weighted score / reranker", "partial",       "not reported"],
        ["Modular RAG [32]",    "routed per task",           "task-specific",             "partial",       "rarely reported"],
        ["Agentic RAG [34]",    "tool-callable, planned",    "varies",                    "partial",       "emerging"],
        ["Starlink hybrid",     "dense + CJK-bigram lexical","RRF, k = 60",               "CJK + Latin",   "yes (jitter-injected)"],
    ],
    "col_widths": [1.0, 1.5, 1.3, 1.0, 1.4],
    "wrap_chars": [16, 18, 18, 14, 20],
    "highlight_row": 4,
    "title": "Table 2-2 · Retrieval-augmented generation regimes",
    "note": "Starlink occupies the same hybrid-plus-agentic axis as Agentic RAG, adding bilingual lexical tokenization and explicit jitter-injected validation."
}

# =====================================================================
# TABLE 3-2: Capability coverage matrix
# =====================================================================

# Legend: ●G generate, ◐V validate, ◇I insight, blank no binding
table_3_2 = {
    "headers": ["Agent",           "CS",  "VP",  "CH",  "CR",  "RS",  "KR",  "KA",  "KP",  "CO"],
    "rows": [
        ["market-agent",            "●G", "",    "●G", "●G", "",    "",    "",    "",    ""    ],
        ["product-agent",           "",   "●G", "",    "",    "",    "●G", "●G", "●G", ""    ],
        ["finance-agent",           "",   "",    "",    "",    "●G", "",    "",    "",    "●G"],
        ["critic",                  "◐V","◐V","◐V","◐V","◐V","◐V","◐V","◐V","◐V"],
        ["synthesizer",             "◇I","◇I","◇I","◇I","◇I","◇I","◇I","◇I","◇I"],
    ],
    "col_widths": [1.4] + [0.5] * 9,
    "col_aligns": ['l'] + ['c'] * 9,
    "title": "Table 3-2 · Capability coverage matrix (rows = agents, columns = canvas dimensions)",
    "note": "●G generate · ◐V validate · ◇I insight · blank = no binding. Coverage requirement: every column contains at least one ●G binding; checked at boot."
}


# =====================================================================
# TABLE 3-1: Roster of the twelve worker agents
# =====================================================================

table_3_1 = {
    "headers": ["Agent role", "Capability declaration (LangGraph subgraph)", "Model tier", "Responsibility in the canvas pipeline"],
    "rows": [
        ["", "", "", ""],  # band 1
        ["Supervisor",         "router subgraph; callability = {bmc-generator, advisor, debate, utility, report}", "base",               "Classifies intent; dispatches active agents via conditional edges; bounds review loop"],
        ["", "", "", ""],  # band 2
        ["Market generator",   "bmc-generator subgraph; capabilities = {CS, CH, CR}",                              "base",               "Produces the three customer-facing dimensions"],
        ["Product generator",  "bmc-generator subgraph; capabilities = {VP, KR, KA, KP}",                          "base",               "Produces the four offering- and resource-facing dimensions"],
        ["Finance generator",  "bmc-generator subgraph; capabilities = {RS, CO}",                                  "base",               "Produces the two revenue- and cost-facing dimensions"],
        ["", "", "", ""],  # band 3
        ["Critic",             "advisor subgraph; strict structured-output binding",                               "base ★",        "Flags cross-dimension conflicts by severity"],
        ["Synthesizer",        "advisor subgraph; cross-cell insight binding",                                     "base",               "Derives insights linking two or more canvas dimensions"],
        ["", "", "", ""],  # band 4
        ["Market opponent",    "debate-side subgraph; challenges market-generator content",                        "reasoning-tier",     "Argues against the market dimensions on high-severity conflict"],
        ["Product opponent",   "debate-side subgraph; challenges product-generator content",                       "reasoning-tier",     "Argues against the product dimensions on high-severity conflict"],
        ["Finance opponent",   "debate-side subgraph; challenges finance-generator content",                       "reasoning-tier",     "Argues against the finance dimensions on high-severity conflict"],
        ["Moderator",          "debate-judge subgraph",                                                            "reasoning-tier",     "Reads proponent–opponent exchange; returns accept/reject per dimension"],
        ["", "", "", ""],  # band 5
        ["General responder",  "utility subgraph",                                                                 "reasoning-tier",     "Handles free-form questions outside the canvas pipeline"],
        ["Deep researcher",    "utility subgraph",                                                                 "reasoning-thinking", "Extended, exploratory analysis when requested"],
        ["Report writer",      "report subgraph",                                                                  "base",               "Produces a six-section narrative report from the canvas"],
    ],
    "band_rows": {
        0:  "Band 1 · Router  (intent classification + dispatch)",
        2:  "Band 2 · BMC generators  (parallel fan-out; disjoint capability subsets covering all nine canvas dimensions)",
        6:  "Band 3 · Advisors  (sequential cross-dimension quality control after generators write)",
        9:  "Band 4 · Adversarial review  (triggered only on high-severity conflict; bounded at three rounds)",
        14: "Band 5 · Utilities  (out-of-pipeline modes; do not write into canvas slots)",
    },
    "col_widths": [1.3, 3.4, 1.1, 2.8],
    "wrap_chars": [14, 28, 10, 22],
    "figsize": (16, 11),
    "title": "Table 3-1 · Roster of the twelve worker agents organized in five functional bands",
    "note": "Each row is a compiled LangGraph subgraph. ★ The critic uses the base tier because its operation requires strict structured output, which interacts poorly with current reasoning-thinking model APIs."
}

# =====================================================================
# TABLE 3-3: Citation taxonomy
# =====================================================================

table_3_3 = {
    "headers": ["Class", "Producer", "Frontend behavior"],
    "rows": [
        ["documentary", "retrieval layer", "opens an evidence drawer with the cited passage"],
        ["structural",  "BMC generators",  "highlights the related canvas cell"],
        ["critique",    "critic",          "opens a review panel with the conflict detail"],
        ["insight",     "synthesizer",     "opens the corresponding cross-cell insight node"],
    ],
    "col_widths": [1.0, 1.2, 2.4],
    "wrap_chars": [16, 20, 40],
    "title": "Table 3-3 · Citation classes and their interaction destinations",
    "note": "Each class is rendered as a typed interactive element on the canvas rather than as inline text."
}

# =====================================================================
# TABLE 3-4: Embedding providers
# =====================================================================

table_3_4 = {
    "headers": ["Provider", "Model", "Dim", "Region notes"],
    "rows": [
        ["Aliyun DashScope",        "text-embedding-v4",      "1 536", "Default in mainland China; matches VECTOR(1536)"],
        ["SiliconFlow",             "bge-m3",                 "1 024", "Alternative; auto-padded to 1 536 dimensions"],
        ["OpenAI",                  "text-embedding-3-small", "1 536", "Used in international deployments only"],
        ["local-hash (offline)",    "deterministic hash-bag", "1 536", "No network; lower quality; for availability"],
    ],
    "col_widths": [1.0, 1.2, 0.5, 2.3],
    "col_aligns": ['l', 'l', 'r', 'l'],
    "wrap_chars": [18, 20, 6, 36],
    "title": "Table 3-4 · Supported embedding providers and their operating characteristics",
    "note": "Provider selection priority: explicit env override → API key presence → URL heuristic → international default."
}

# =====================================================================
# TABLE 3-5: Judge calibration on degenerate inputs
# =====================================================================

table_3_5 = {
    "headers": ["Degenerate input", "Score / 27"],
    "rows": [
        ["Echo of the question repeated into all nine cells", "0–1"],
        ["Null response (empty cells)",                       "0"],
        ["Generic business-template boilerplate",             "1–2"],
    ],
    "col_widths": [3.0, 0.7],
    "col_aligns": ['l', 'r'],
    "wrap_chars": [56, 12],
    "title": "Table 3-5 · Judge calibration on three degenerate inputs",
    "note": "All three return near-floor scores, confirming the rubric anchors on must-cover concept presence rather than text quantity."
}

# =====================================================================
# TABLE 3-6: Recall@5 under jitter — vector vs hybrid
# =====================================================================

table_3_6 = {
    "headers": ["Retriever", "recall@5 under jitter"],
    "rows": [
        ["Vector",            "1.514"],
        ["Hybrid (proposed)", "1.944 (+28.4 %)"],
    ],
    "col_widths": [1.5, 1.6],
    "col_aligns": ['l', 'r'],
    "highlight_row": 1,
    "title": "Table 3-6 · Retrieval recall@5 under embedding-service jitter",
    "note": "Under healthy embedding service the two retrievers are indistinguishable; the lexical channel functions as a reliability safeguard, not as a quality lift."
}

# =====================================================================
# TABLE 3-7: Multi-agent vs single-LLM aggregate (12 YC cases)
# =====================================================================

table_3_7 = {
    "headers": ["Backend", "Runner", "Mean / 27", "Q-cov (full-9)", "Case wins", "KP=0 rate"],
    "rows": [
        ["DeepSeek-V3 (strong)",  "gpt-solo", "20.2", "0 / 12",  "3 / 12",  "12 / 12"],
        ["",                       "starlink", "20.8", "12 / 12", "8 / 12",  "0 / 12"],
        ["MiniMax-M2.5 (mid)",    "gpt-solo", "8.4",  "1 / 12",  "1 / 12",  "12 / 12"],
        ["",                       "starlink", "15.2", "9 / 12",  "8 / 12",  "0 / 12"],
    ],
    "col_widths": [1.4, 0.8, 0.7, 0.9, 0.8, 0.8],
    "col_aligns": ['l', 'l', 'r', 'c', 'r', 'c'],
    "highlight_row": 3,
    "title": "Table 3-7 · Quality comparison across two frontier-class backends (N = 12 YC seed cases per backend)",
    "note": "Q-cov counts cases with all 9 BMC dimensions non-zero. KP=0 rate is fraction of cases where KEY_PARTNERSHIPS scored zero (the canvas-tail blind spot). MiniMax starlink row highlighted as the largest measured delta."
}

# =====================================================================
# TABLE 3-8: Cross-vendor single-LLM baseline
# =====================================================================

table_3_8 = {
    "headers": ["Provider", "Model", "Cases", "Mean / 27", "KP = 0", "Other empty-cell prevalence"],
    "rows": [
        ["primary (headline)",     "base-tier model", "12", "18.7", "12 / 12", "none"],
        ["alternative provider A", "DeepSeek-class",  "12", "17.6", "11 / 12", "none"],
        ["alternative provider A", "MiniMax-class",   "12", "13.6", "12 / 12", "KA, KR, CH"],
        ["alternative provider B", "MiniMax-class",   "6",  "16.2", "6 / 6",   "KA, KR, CH (mild)"],
    ],
    "col_widths": [1.5, 1.2, 0.5, 0.7, 0.7, 1.6],
    "col_aligns": ['l', 'l', 'r', 'r', 'r', 'l'],
    "wrap_chars": [22, 18, 8, 12, 10, 24],
    "title": "Table 3-8 · Single-LLM baseline scores across multiple model providers",
    "note": "Same prompt, same judge across all rows. KEY_PARTNERSHIPS = 0 reproduces in 35 of 36 cross-vendor cases."
}

# =====================================================================
# TABLE 3-9: Same-LLM control (multi-agent vs single-LLM)
# =====================================================================

table_3_9 = {
    "headers": ["Backend", "gpt-solo / 27", "Multi-agent / 27", "Δ", "gpt-solo dim-coverage", "Multi-agent dim-coverage"],
    "rows": [
        ["primary (base-tier model)",            "19.8", "20.3", "+0.5", "0 / 6 cases full", "6 / 6 cases full"],
        ["alternative provider, DeepSeek-class", "18.5", "19.2", "+0.7", "1 / 6 cases full", "6 / 6 cases full"],
        ["alternative provider, MiniMax-class",  "14.5", "18.8", "+4.3", "0 / 6 cases full", "6 / 6 cases full"],
    ],
    "col_widths": [1.7, 0.9, 1.0, 0.5, 1.2, 1.3],
    "col_aligns": ['l', 'r', 'r', 'r', 'l', 'l'],
    "wrap_chars": [22, 12, 14, 8, 18, 18],
    "highlight_row": 2,
    "title": "Table 3-9 · Multi-agent system vs single-LLM baseline under identical language-model backends",
    "note": "Under same-LLM control, the multi-agent system recovers full dimension coverage on every backend, regardless of which backend is used."
}

# =====================================================================
# TABLE 3-10: End-to-end wall-clock breakdown
# =====================================================================

table_3_10 = {
    "headers": ["Stage", "Wall-clock"],
    "rows": [
        ["Supervisor routing",                 "~1 s"],
        ["Three BMC generators (parallel)",    "~70 s"],
        ["Sixteen dimension actions",          "~30 s"],
        ["Critic",                             "~10 s"],
        ["Synthesizer",                        "~5 s"],
        ["Total",                              "96–125 s"],
    ],
    "col_widths": [2.0, 0.9],
    "col_aligns": ['l', 'r'],
    "highlight_row": 5,
    "title": "Table 3-10 · End-to-end wall-clock per BMC generation",
    "note": "Latency is dominated by language-model completion time, not by orchestration overhead. Token usage runs roughly 5–10× the single-LLM baseline."
}

# =====================================================================
# TABLE 3-11: Five-condition design ablation
# =====================================================================

table_3_11 = {
    "headers": ["Condition", "Stripe", "Airbnb", "Replit", "Notion", "Brex", "Substack", "Mean"],
    "rows": [
        ["minimal",   "24", "21", "20", "20", "21", "20", "21.00"],
        ["no-RAG",    "24", "20", "20", "23", "20", "20", "21.17"],
        ["full",      "23", "21", "21", "23", "23", "20", "21.83"],
        ["no-debate", "24", "23", "22", "22", "20", "21", "22.00"],
        ["no-critic", "24", "23", "21", "21", "24", "20", "22.17"],
    ],
    "col_widths": [1.0] + [0.6] * 6 + [0.7],
    "col_aligns": ['l'] + ['r'] * 7,
    "title": "Table 3-11 · Five-condition design ablation on the YC validator set (n = 6)",
    "note": "Removing retrieval grounding (no-RAG) is the only ablation that drops both mean and worst-case. Critic / debate-loop removal stays within judge noise on this six-case sample."
}


if __name__ == "__main__":
    render_table(**table_2_1, out_filename="table2-1-frameworks.png")
    render_table(**table_2_2, out_filename="table2-2-rag-regimes.png")
    render_table(**table_3_1, out_filename="table3-1-agents-by-band.png")
    render_table(**table_3_2, out_filename="table3-2-coverage-matrix.png")
    render_table(**table_3_3, out_filename="table3-3-citation-taxonomy.png")
    render_table(**table_3_4, out_filename="table3-4-embedding-providers.png")
    render_table(**table_3_5, out_filename="table3-5-judge-calibration.png")
    render_table(**table_3_6, out_filename="table3-6-recall-jitter.png")
    render_table(**table_3_7, out_filename="table3-7-aggregate.png")
    render_table(**table_3_8, out_filename="table3-8-cross-vendor.png")
    render_table(**table_3_9, out_filename="table3-9-same-llm-control.png")
    render_table(**table_3_10, out_filename="table3-10-wallclock.png")
    render_table(**table_3_11, out_filename="table3-11-ablation.png")
    print("\nAll tables rendered.")
