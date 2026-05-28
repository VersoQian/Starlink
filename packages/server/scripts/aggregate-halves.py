#!/usr/bin/env python3
"""Aggregate per-half yc-vs-runners reports into a single consolidated report.

Reads K markdown reports from parallel-bench.sh and emits a single report
with:
- combined per-case TL;DR table (all 12 cases stitched together)
- recomputed Aggregate by runner (true mean across full case set)
- preserved per-dimension grids appended

Usage:
    aggregate-halves.py --backend MODEL --output PATH report1.md report2.md ...
"""
import argparse
import re
import sys
from pathlib import Path
from collections import defaultdict


def parse_report(path):
    """Return dict with 'tldr_rows', 'agg_rows', 'cases', 'runners', 'dim_rows'."""
    text = Path(path).read_text()

    # Cases header line — for sanity check
    cases_match = re.search(r"^Cases: (\d+) \((.+)\)$", text, re.M)
    cases_list = []
    if cases_match:
        cases_list = [c.strip() for c in cases_match.group(2).split(",")]

    # Runners
    runners_match = re.search(r"^Runners: (.+)$", text, re.M)
    runners = [r.strip() for r in runners_match.group(1).split(",")] if runners_match else []

    # TL;DR table — rows between header line and next "## "
    tldr_section = re.search(
        r"## TL;DR.+?\n(\| case \|.+?\n\| --- \|.+?\n)(.+?)\n\n## ",
        text,
        re.S,
    )
    tldr_rows = []
    if tldr_section:
        for line in tldr_section.group(2).strip().splitlines():
            if line.startswith("|"):
                tldr_rows.append(line)

    # Aggregate table
    agg_section = re.search(
        r"## Aggregate.+?\n(\| runner \|.+?\n\| --- \|.+?\n)(.+?)\n\n## ",
        text,
        re.S,
    )
    agg_rows = []
    if agg_section:
        for line in agg_section.group(2).strip().splitlines():
            if line.startswith("|"):
                agg_rows.append(line)

    # Per-dim grid
    dim_section = re.search(
        r"## Per-dimension score grid\n(\| case \|.+?\n\| --- \|.+?\n)(.+?)(?=\n## |\Z)",
        text,
        re.S,
    )
    dim_rows = []
    if dim_section:
        for line in dim_section.group(2).strip().splitlines():
            if line.startswith("|"):
                dim_rows.append(line)

    return {
        "cases": cases_list,
        "runners": runners,
        "tldr_rows": tldr_rows,
        "agg_rows": agg_rows,
        "dim_rows": dim_rows,
        "source_path": str(path),
    }


def parse_score_cell(s):
    """Extract numerator from '24/27 (2.67)' → 24."""
    m = re.match(r"^\s*(\d+)/27", s.strip())
    return int(m.group(1)) if m else None


def parse_float_cell(s):
    m = re.match(r"^\s*([\d.]+)/27", s.strip())
    return float(m.group(1)) if m else None


def aggregate_agg_rows(half_reports):
    """Recompute Aggregate by runner: weighted mean across all halves."""
    # Each agg row format:
    # | runner | mean total | mean avg | mean candidate chars | mean duration |
    by_runner = defaultdict(list)  # runner -> list of (mean_total, mean_avg, chars, duration)

    for r in half_reports:
        n_cases = len(r["cases"])
        for row in r["agg_rows"]:
            parts = [p.strip() for p in row.strip("|").split("|")]
            if len(parts) < 5:
                continue
            runner = parts[0]
            mean_total = parse_float_cell(parts[1])
            mean_avg = float(parts[2]) if re.match(r"^[\d.]+$", parts[2]) else None
            chars = int(parts[3]) if parts[3].isdigit() else None
            # duration like "10.5s"
            dur_match = re.match(r"^([\d.]+)s?$", parts[4])
            duration = float(dur_match.group(1)) if dur_match else None
            by_runner[runner].append((n_cases, mean_total, mean_avg, chars, duration))

    out_rows = []
    for runner, entries in by_runner.items():
        total_n = sum(e[0] for e in entries)
        if total_n == 0:
            continue
        wmean = lambda idx: sum(e[0] * e[idx] for e in entries if e[idx] is not None) / total_n
        out_rows.append(
            "| {} | {:.1f}/27 | {:.2f} | {:.0f} | {:.1f}s |".format(
                runner,
                wmean(1) if any(e[1] is not None for e in entries) else 0,
                wmean(2) if any(e[2] is not None for e in entries) else 0,
                wmean(3) if any(e[3] is not None for e in entries) else 0,
                wmean(4) if any(e[4] is not None for e in entries) else 0,
            )
        )

    return out_rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", required=True, help="Backend model id")
    ap.add_argument("--output", required=True, help="Output consolidated report path")
    ap.add_argument("reports", nargs="+", help="Per-half report .md paths")
    args = ap.parse_args()

    halves = [parse_report(p) for p in args.reports]

    # Sanity: collect all cases across halves
    all_cases = []
    for h in halves:
        all_cases.extend(h["cases"])
    runners = halves[0]["runners"] if halves else []

    # Combine TL;DR rows preserving order across halves
    combined_tldr = []
    for h in halves:
        combined_tldr.extend(h["tldr_rows"])

    # Combined per-dim grid
    combined_dim = []
    for h in halves:
        combined_dim.extend(h["dim_rows"])

    # Recompute aggregate
    agg_rows = aggregate_agg_rows(halves)

    # Emit consolidated
    output_lines = [
        f"# Consolidated benchmark — {args.backend}",
        f"",
        f"Aggregated from {len(halves)} parallel halves:",
    ]
    for h in halves:
        output_lines.append(f"- `{h['source_path']}` ({len(h['cases'])} cases)")
    output_lines += [
        f"",
        f"Total cases: {len(all_cases)} ({', '.join(all_cases)})",
        f"Runners: {', '.join(runners)}",
        f"",
        f"## TL;DR — total scores per case × runner",
        f"",
        "| case | company | KB | " + " | ".join(f"{r} total" for r in runners) + " | winner |",
        "| --- | --- | --- | " + " | ".join("---" for _ in runners) + " | --- |",
    ]
    output_lines.extend(combined_tldr)
    output_lines += [
        f"",
        f"## Aggregate by runner (recomputed across all cases)",
        f"",
        "| runner | mean total | mean avg | mean candidate chars | mean duration |",
        "| --- | --- | --- | --- | --- |",
    ]
    output_lines.extend(agg_rows)
    output_lines += [
        f"",
        f"## Per-dimension score grid (concatenated)",
        f"",
        "| case | runner | CU VA CH CU RE KE KE KE CO | total |",
        "| --- | --- | -- -- -- -- -- -- -- -- -- | --- |",
    ]
    output_lines.extend(combined_dim)

    Path(args.output).write_text("\n".join(output_lines) + "\n")
    print(f"wrote {args.output}")
    print(f"  cases: {len(all_cases)}")
    print(f"  runners: {runners}")
    print(f"  aggregate rows: {len(agg_rows)}")


if __name__ == "__main__":
    main()
