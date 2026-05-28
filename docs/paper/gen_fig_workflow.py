#!/usr/bin/env python3
"""Re-generate Fig 1-1 (single-LLM vs Starlink workflow) — STRUCTURAL ONLY, no result numbers."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {
    "x-df-ability": "df-ability-google-gemini",
    "x-df-access-key": "yunying",
    "x-df-secret-key": "ths123456",
    "Content-Type": "application/json",
}
POLL_HEADERS = {k: v for k, v in HEADERS.items() if k != "Content-Type"}

PROMPT = """A clean, minimalist academic-paper figure in the editorial style of NeurIPS / ICLR papers. Strictly black, white, and one muted navy accent (#1f4f8b). No gradients, no glassmorphism, no purple, no AI-slop aesthetics. White background. Aspect ratio 16:9.

The figure shows a side-by-side STRUCTURAL comparison of two reasoning paradigms — NO benchmark numbers, NO timings, NO character counts. The purpose is to contrast workflow shapes only.

LEFT PANEL — header "Single-LLM baseline" inside a thin grey 1px border:
A simple vertical pipeline of 4 boxes, top to bottom, connected by downward arrows:
  1. Rounded box "user question"
  2. Box "prompt template"
  3. Square box "one LLM call"
  4. Rounded box "9-cell BMC output"

Caption strip below the panel: "linear · one shot"

RIGHT PANEL — header "Starlink · 12-agent orchestration" inside a 1.5px navy blue border:
A multi-branch flow:
  - Top: rounded box "user @mention"
  - Down to: hexagonal box "Supervisor router"
  - The supervisor splits into 3 parallel boxes side by side: "market-agent", "product-agent", "finance-agent"  (each with a thin label "BMC generator")
  - A cylinder/database shape "hybrid RAG" feeds into the 3 generators from the left
  - All 3 generators merge into one diamond "Critic"
  - The diamond branches into two labels: "high severity" leading to a small subgraph "Debate · 3 opponents + moderator" which loops back up to the generators; and "no conflict" leading down to:
  - Box "Synthesizer"
  - Bottom: rounded box "canvas with citations"

Caption strip below the panel: "fan-out · grounded · bounded debate"

Between the two panels, a thin grey vertical divider. At the very top center, a small horizontal label "vs" or "compare" in italic grey.

Typography: clean editorial serif (Fraunces / Source Serif) for body labels; monospace (JetBrains Mono) for the agent names and "RAG", "Critic", "Synthesizer" labels. Sharp 4px or smaller corner radius. 1.5px navy borders on important boxes. Tabular numerals (but no actual numbers should appear). No emojis. No icons except the database cylinder for RAG. Restrained, information-dense, typographically refined.

CRITICAL: Do NOT include any benchmark numbers, latencies, character counts, percentages, durations, or quantitative annotations. The figure shows the STRUCTURAL difference between paradigms only."""

print("Submitting Gemini image-gen task (v2 — structural only, no numbers)...")
payload = {
    "model": "gemini-3-pro-image-preview",
    "contents": [{"parts": [{"text": PROMPT}]}],
}
r = requests.post(API_SUBMIT, headers=HEADERS, json=payload, timeout=30)
data = r.json()
print("Submit:", json.dumps(data, indent=2)[:400])
task_id = data.get("data", {}).get("task_id")
if not task_id:
    print("ERROR: no task_id"); sys.exit(1)

for attempt in range(60):
    time.sleep(5)
    r = requests.get(API_STATUS.format(task_id), headers=POLL_HEADERS, timeout=30)
    data = r.json()
    status = data.get("data", {}).get("status", "?")
    print(f"[{attempt:02d}] {status}")
    if status == "FINISHED":
        result = data["data"].get("result", "")
        img_url = data["data"].get("imageUrl") or (result if isinstance(result, str) and result.startswith("http") else None)
        if not img_url and isinstance(result, str):
            try: img_url = json.loads(result).get("imageUrl") or json.loads(result).get("url")
            except: pass
        if not img_url:
            print("Full:", json.dumps(data["data"], indent=2)[:800])
        if img_url:
            out_path = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig1-1-workflow.png"
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            ir = requests.get(img_url, timeout=60)
            with open(out_path, "wb") as f: f.write(ir.content)
            print(f"Saved: {out_path} ({len(ir.content)} bytes)")
        sys.exit(0)
    elif status in ("FAILED", "ERROR"):
        print("FAILED:", json.dumps(data, indent=2)[:600]); sys.exit(2)

print("TIMEOUT"); sys.exit(3)
