#!/usr/bin/env python3
"""Generate Fig 4-0: 5-layer deployable architecture."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean layered system-architecture diagram in academic system-paper style. Light pastel color palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale amber (#FCEDD7), pale peach (#FAE3E0), pale grey (#F4F4F6). White background. Aspect ratio 16:9. NO gradients, NO purple AI aesthetic.

The diagram shows the FIVE-LAYER DEPLOYABLE ARCHITECTURE of the Starlink system. The layers are stacked top-to-bottom, each as its own horizontal panel with a distinct pastel fill and a 1px colored border. Each panel has a small monospace label on the left edge ("L5", "L4", "L3", "L2", "L1") and a serif title on the right.

LAYER 5 (top, pale blue): "L5 · Frontend"
  Contents: a single rectangle "Canvas-based interaction surface" with a small subtitle "React Flow infinite canvas · typed nodes and edges"
  Color: pale blue (#E3F0FA)

LAYER 4 (pale grey): "L4 · Unified Gateway"
  Contents: a single rectangle "GraphQL query · mutation · subscription" with subtitle "Apollo Server · HTTP + WebSocket"

LAYER 3 (pale green, the largest panel — give it ~30% of the vertical space): "L3 · Multi-Agent Reasoning Core"
  Contents: two side-by-side elements:
    - LEFT: rounded rectangle "12 specialized LangGraph subgraphs" with a tiny grid of 12 small dots inside it
    - RIGHT: horizontal cylinder/database "shared blackboard (Annotation.Root)"
    - A double-headed arrow between them labeled "read · write"
  Subtitle below: "supervisor-routed · conditional-edge dispatch · checkpointer for replay"

LAYER 2 (pale amber): "L2 · Knowledge Layer"
  Contents: a single rectangle "bilingual hybrid retrieval" with subtitle "dense vector channel + Unicode-class lexical channel · RRF fusion"

LAYER 1 (bottom, pale peach): "L1 · Persistence"
  Contents: four small rectangles in a row, labeled "user / session", "canvas / knowledge", "reasoning state", "observability / security". A small subtitle below: "PostgreSQL with vector extension"

ON THE RIGHT MARGIN of the figure (vertical strip outside the layered stack), a small "user" icon at the top with a downward arrow labeled "request flow" and an upward arrow labeled "subscription delta", both spanning the full height — showing that requests flow downward and events flow upward through all 5 layers.

ARROWS between adjacent layers (drawn between the panels):
  - L5 → L4: solid arrow labeled "GraphQL"
  - L4 → L3: solid arrow labeled "service call"
  - L3 → L2: solid arrow labeled "top-K retrieval"
  - L2 → L1: solid arrow labeled "SQL"
  - L3 dashed to L1 labeled "checkpoint · resume"
  - L4 dashed to L1 labeled "audit · SLO"

Top of figure: italic banner "Five-layer deployable architecture · Starlink".

Typography: clean serif for layer titles, sans-serif for box labels, monospace for "L1-L5" labels and technical subtitles. Sharp 4px corner radius on inner boxes; 6px on layer panels. 1.5px solid borders on panel outlines, 1px on inner boxes. NO drop shadows. NO emojis. Tabular numerals.

The diagram should read like Figure 1 of a system paper at OSDI / SOSP / NSDI: layered, professional, information-dense without clutter."""

def submit_retry():
    for a in range(5):
        try:
            return requests.post(API_SUBMIT, headers=HEADERS, json={"model":"gemini-3-pro-image-preview","contents":[{"parts":[{"text":PROMPT}]}]}, timeout=60).json()
        except requests.exceptions.RequestException: time.sleep(5*(a+1))
    sys.exit("submit failed")

def poll_retry(task_id, mx=80):
    for a in range(mx):
        time.sleep(6)
        try:
            d = requests.get(API_STATUS.format(task_id), headers=POLL_HEADERS, timeout=60).json()
            s = d.get("data",{}).get("status","?"); print(f"[{a:02d}] {s}")
            if s == "FINISHED": return d["data"]
            if s in ("FAILED","ERROR"): print(json.dumps(d,indent=2)[:600]); sys.exit(2)
        except requests.exceptions.RequestException: continue
    sys.exit("timeout")

print("Submitting Gemini for Fig 4-0 (5-layer architecture)...")
data = submit_retry(); task_id = data.get("data",{}).get("task_id")
if not task_id: sys.exit("no task_id")
result = poll_retry(task_id); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")

out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig4-0-5layer.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
