#!/usr/bin/env python3
"""Generate Fig 3-1: Three-pillar overview in MetaGPT/Meflex academic-paper style."""
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

PROMPT = """A clean, modern academic system-architecture diagram in the style of MetaGPT and Meflex papers. Light pastel color palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale orange/peach (#FCEDD7), pale grey (#F4F4F6). Use these colors to distinguish the three pillars. Plain white background. Aspect ratio 16:9. NO gradients, NO glassmorphism, NO purple-AI aesthetic. NO dark mode.

The diagram shows THREE CO-EQUAL PILLARS of a multi-agent business-canvas system, arranged side-by-side horizontally, each in its own panel with a thin colored border (color matches the pillar's pastel fill). All three panels have equal width and equal height.

IMPORTANT — DO NOT INCLUDE ANY POSITIONAL OR NUMBERING TAGS ABOVE THE PILLAR HEADERS. Specifically, FORBIDDEN strings anywhere in the rendered image: "LEFT PILLAR", "MIDDLE PILLAR", "RIGHT PILLAR", "LEFT PANEL", "RIGHT PANEL", "PILLAR 1", "PILLAR 2", "PILLAR 3", "PANEL 1", "PANEL 2", "PANEL 3", "COLUMN 1", "COLUMN 2", "COLUMN 3", "TOP", "BOTTOM". Each pillar is identified ONLY by its title text and the ①/②/③ marker inside the subtitle. There is no separate header tag above the title.

The first pillar (pale blue, #E3F0FA fill, #1f4f8b border): the FIRST line of text inside this pillar is the title "Multi-Agent Reasoning Core" rendered in clean serif. The second line is a small monospace subtitle "① · LangGraph". Nothing else appears above the title.

Inside this pillar (BELOW the title, in MetaGPT Figure-1 style with role icons): five small agent rectangles with a tiny abstract role-icon next to each name (NOT humanoid faces — flat single-color line glyphs):
   - "Supervisor" with a small router/branch icon
   - Three side-by-side: "Market" (bar-chart icon), "Product" (box icon), "Finance" (coin icon)
   - "Critic" (magnifying-glass icon) and "Synthesizer" (puzzle-piece icon) on a row below
   - At the bottom of the pillar a small cylinder labeled "shared blackboard (Annotation.Root)"
   - Solid arrows from Supervisor down to the 3 generators; dashed arrows from all agents into the cylinder
   - To the right of the cylinder, a tiny preview pill showing one example slot: "bs.canvas[KEY_PARTNERSHIPS] = [...]"  (monospace, gray)
  Contents (top to bottom):
  - One round rectangle at top labeled "Supervisor" (slightly larger, navy outline)
  - Below: three rounded rectangles in a horizontal row labeled "Market", "Product", "Finance" (these are domain generators)
  - Below that: a small row of two rectangles labeled "Critic" and "Synthesizer"
  - At the bottom: a horizontal cylinder/database shape labeled "shared blackboard (Annotation.Root)"
  - Solid arrows from Supervisor down to the three generators, dashed arrows from all the agent boxes down into the cylinder

The second pillar (pale green, #E6F2E7 fill, #4a7a4f border): the FIRST line of text inside this pillar is the title "Bilingual Hybrid Retrieval". The second line is a small monospace subtitle "② · vector + lexical fusion". Nothing else appears above the title.

Inside this pillar (BELOW the title): two parallel rounded rectangles — "dense vector channel" and "Unicode-class lexical channel" — with a small italic note "CJK bigrams + Latin words" under the right one. Both flow down with arrows converging into a single hexagonal box labeled "RRF fusion". Below the fusion box, ALSO INCLUDE A SMALL ARTIFACT PREVIEW: a tiny ranked list of three text rows looking like search results, monospace, e.g.:
   "1. stripe-s1.pdf #7  score 1.55"
   "2. notion-mkt.pdf #2 score 1.43"
   "3. brex-pol.pdf  #5 score 1.21"
This makes the retrieval output concrete.
  Contents (top to bottom):
  - Two parallel rounded rectangles at top: left says "dense vector channel", right says "Unicode-class lexical channel"
  - A small note under the right one in italic: "CJK bigrams + Latin words"
  - Both flow down with arrows converging into a single hexagonal box labeled "RRF fusion"
  - Below that: a small label "top-K evidence chunks"

The third pillar (pale peach, #FCEDD7 fill, #c87a3e border): the FIRST line of text inside this pillar is the title "Canvas-First Interaction Surface". The second line is a small monospace subtitle "③ · 9-cell visual workspace". Nothing else appears above the title.

Inside this pillar (BELOW the title): a 3×3 grid of nine small rounded squares that represent the BMC canvas cells. INSTEAD OF leaving these blank, render a tiny bit of content in each cell (just 2-3 placeholder lines like dummy text rules) plus a small citation chip icon at the bottom-right of one cell (e.g., the KP cell). This makes the canvas concrete. Below the grid: three small floating rectangles "chat", "evidence drawer", "agent health". A small arrow from the citation chip dot in the KP cell pointing into the "evidence drawer" rectangle. Optional: a small speech-bubble at the lower-left attached to "chat" containing dummy text: "User: focus on the RS cell" (italic, in pale grey) — to anchor the user interaction concretely, mirroring the MetaGPT-style worked example.
  Contents (top to bottom):
  - A 3-by-3 grid of small squares representing the 9 BMC canvas cells; each cell has a tiny round dot in the corner to suggest a citation chip
  - Below the grid: three small floating rectangles labeled "chat", "evidence drawer", "agent health"
  - A small arrow from one citation dot in the grid pointing to the "evidence drawer" rectangle

DATA-FLOW ARROWS between the three pillars (these arrows have ONLY the labels listed below — they do NOT include the words "pillar", "panel", or any positional reference in the label text):
  - Horizontal arrow from the second pillar into the first pillar: label "top-K evidence on every agent call"
  - Horizontal arrow from the first pillar into the third pillar: label "canvas deltas + citation tokens"
  - Thinner reverse arrow from the third pillar back into the first pillar: label "@mention · edits"

Top of figure: small italic banner "Starlink · three-pillar system overview".

Typography: clean serif (Source Serif / Fraunces) for the pillar headers; clean sans-serif (Inter / Geist Sans) for the box labels; monospace (JetBrains Mono) for the technical subtitles (LangGraph, RRF, etc.). All text in dark grey/black for readability against the pastel fills. Sharp 6px corner radius on all boxes. 1.5px solid borders on each pillar's outer panel, 1px on inner boxes. No drop shadows. Tabular numerals.

The figure should look like Figure 1 of an ACL/EMNLP/CHI paper — pastel-colored architecture diagram with directional flow arrows, polished but not flashy."""

def submit_with_retry():
    for attempt in range(5):
        try:
            r = requests.post(API_SUBMIT, headers=HEADERS, json={
                "model": "gemini-3-pro-image-preview",
                "contents": [{"parts": [{"text": PROMPT}]}],
            }, timeout=60)
            return r.json()
        except requests.exceptions.RequestException as e:
            print(f"[submit attempt {attempt+1}/5] {type(e).__name__}: {e}")
            time.sleep(5 * (attempt + 1))
    sys.exit("submit failed after retries")

def poll_with_retry(task_id, max_attempts=80):
    for attempt in range(max_attempts):
        time.sleep(6)
        try:
            r = requests.get(API_STATUS.format(task_id), headers=POLL_HEADERS, timeout=60)
            data = r.json()
            status = data.get("data", {}).get("status", "?")
            print(f"[{attempt:02d}] {status}")
            if status == "FINISHED":
                return data["data"]
            if status in ("FAILED", "ERROR"):
                print("FAILED:", json.dumps(data, indent=2)[:600])
                sys.exit(2)
        except requests.exceptions.RequestException as e:
            print(f"[poll {attempt}] transient {type(e).__name__}, retry...")
            continue
    sys.exit("timed out")

print("Submitting Gemini job for Fig 3-1 (3-pillar overview, MetaGPT/Meflex style)...")
data = submit_with_retry()
print("Submit:", json.dumps(data, indent=2)[:300])
task_id = data.get("data", {}).get("task_id")
if not task_id:
    sys.exit("no task_id")

result = poll_with_retry(task_id)
result_str = result.get("result", "")
img_url = result.get("imageUrl") or (result_str if isinstance(result_str, str) and result_str.startswith("http") else None)
if not img_url and isinstance(result_str, str):
    try: img_url = json.loads(result_str).get("imageUrl") or json.loads(result_str).get("url")
    except: pass

if not img_url:
    print("Full result:", json.dumps(result, indent=2)[:800])
    sys.exit("no image URL")

out_path = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-1-three-pillar.png"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
for attempt in range(5):
    try:
        ir = requests.get(img_url, timeout=120)
        with open(out_path, "wb") as f: f.write(ir.content)
        print(f"Saved: {out_path} ({len(ir.content)} bytes)")
        sys.exit(0)
    except requests.exceptions.RequestException as e:
        print(f"[download {attempt+1}/5] {type(e).__name__}: {e}")
        time.sleep(5 * (attempt + 1))
sys.exit("download failed")
