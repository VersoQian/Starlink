#!/usr/bin/env python3
"""Generate Fig 2-2: Four multi-agent frameworks ordered by coverage-enforcement strategy.

Survey-style spectrum (CAMEL -> AutoGen -> MetaGPT -> Magentic-One). No "this work"
column - Starlink positioning is handled in the caption and in Chapter 3."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic spectrum diagram showing FOUR MULTI-AGENT LANGUAGE-MODEL FRAMEWORKS ORDERED BY THEIR COVERAGE-ENFORCEMENT STRATEGY. Aspect ratio 16:6 (wide horizontal). White background. Light pastel palette: pale red (#FAE3E0) on the left, pale amber (#FCEDD7), pale amber-yellow (slightly stronger), pale blue (#E3F0FA) on the right. NO purple AI aesthetic, NO emojis, NO drop shadows. NO green box, NO "this work" or "Starlink" label anywhere in the figure.

The visual is a horizontal axis with four framework boxes placed left-to-right at evenly spaced positions. Below the axis is a label "Coverage-enforcement rigidity: emergent → orchestrated". Above the axis is a small banner "Four multi-agent LLM frameworks · ordered by coverage strategy".

The four framework boxes (left to right):

1. LEFTMOST · pale red fill:
   Title: "CAMEL [25]"
   Subtitle: "emergent from dialogue"

2. SECOND · pale amber fill:
   Title: "AutoGen [26]"
   Subtitle: "group-chat protocol"

3. THIRD · pale amber fill (slightly stronger):
   Title: "MetaGPT [27]"
   Subtitle: "standardized procedures"

4. RIGHTMOST · pale blue fill:
   Title: "Magentic-One [28]"
   Subtitle: "orchestrator planning"

Between each adjacent pair of boxes, draw a thin right-pointing arrow. The arrows progressively increase in line weight from left to right (1px → 1.5px → 2px) to suggest increasing enforcement rigidity.

Below each framework box, add a tiny monospace one-line phrase summarizing where coverage is decided:
  · CAMEL: "by prompts"
  · AutoGen: "by group-chat"
  · MetaGPT: "by SOP role"
  · Magentic-One: "by orchestrator plan"

At the bottom of the figure, a small italicized monospace note: "The frameworks span emergent (left) to orchestrated (right) approaches. More orchestrated frameworks are more suitable for structured artifacts with known coverage requirements."

TYPOGRAPHY: clean serif for the top banner, sans-serif for box titles, monospace for subtitles and bottom captions. 6 px corner radius on boxes. 1.5 px borders on all framework boxes (uniform — no single box emphasized). No drop shadows, no gradients on the box fills (flat color only). Tabular numerals.

The figure should look like a horizontal spectrum diagram from a survey paper — clean, scannable left-to-right, neutral framing with all four frameworks treated equally."""

def submit_retry():
    for a in range(5):
        try: return requests.post(API_SUBMIT, headers=HEADERS, json={"model":"gemini-3-pro-image-preview","contents":[{"parts":[{"text":PROMPT}]}]}, timeout=60).json()
        except requests.exceptions.RequestException: time.sleep(5*(a+1))
    sys.exit("submit failed")

def poll_retry(t, mx=80):
    for a in range(mx):
        time.sleep(6)
        try:
            d = requests.get(API_STATUS.format(t), headers=POLL_HEADERS, timeout=60).json()
            s = d.get("data",{}).get("status","?"); print(f"[{a:02d}] {s}")
            if s == "FINISHED": return d["data"]
            if s in ("FAILED","ERROR"): print(json.dumps(d,indent=2)[:600]); sys.exit(2)
        except requests.exceptions.RequestException: continue
    sys.exit("timeout")

print("Submitting Gemini for Fig 2-2 (4 frameworks spectrum, survey-style)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig2-2-framework-spectrum.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
