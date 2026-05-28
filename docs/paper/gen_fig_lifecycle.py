#!/usr/bin/env python3
"""Generate Fig 4-0b: Eight-hop request lifecycle sequence diagram."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic UML-style sequence diagram showing an EIGHT-HOP REQUEST LIFECYCLE. Aspect ratio 16:9. White background. Light pastel palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale grey (#F4F4F6), pale amber (#FCEDD7). NO purple AI aesthetic, NO emojis, NO drop shadows.

Style reference: a UML sequence diagram like those in ACL/CHI/NeurIPS systems papers — clean serif title at top, sans-serif participant labels, monospace for method names, time flows top-to-bottom.

Top of figure: italic banner "Request lifecycle · 8 hops from user input to canvas update".

SEVEN PARTICIPANT LIFELINES from left to right, each as a rounded rectangle at the top labeled by name, with a dashed vertical lifeline extending downward:
  1. "User" (pale grey rectangle)
  2. "Frontend" (pale blue)
  3. "GraphQL Gateway" (pale blue)
  4. "mention-router" (pale green)
  5. "kb-store" (pale green)
  6. "business-langgraph" (pale amber)
  7. "PostgreSQL" (pale grey)

NUMBERED HORIZONTAL ARROWS between lifelines, in temporal order:
  1. User → Frontend: "types @market-agent ..."
  2. Frontend → Frontend (self-call, small loop on its own lifeline): "mentionAgent"
  3. Frontend → GraphQL Gateway: "Mutation.mentionAgent"
  4. GraphQL Gateway → mention-router: "resolve by callability"
  5. mention-router → kb-store: "searchChunksHybrid"
  6. kb-store → mention-router (return arrow, dashed): "top-K chunks"
  7. mention-router → business-langgraph: "invokeRegisteredAgent"
  8. business-langgraph → business-langgraph (self-call): "generator → critic → synthesizer"
  9. business-langgraph → PostgreSQL: "canvas_graphs UPSERT"
  10. business-langgraph → GraphQL Gateway (return arrow, dashed): "conversationProgress event"
  11. GraphQL Gateway → Frontend (return arrow, dashed): "subscription delta"
  12. Frontend → Frontend (self-call): "applyDelta — merge by id"
  13. Frontend → User (return arrow, dashed): "canvas updates within one frame"

VISUAL STYLE:
  - Solid filled arrowheads for forward calls (steps 1, 3, 4, 5, 7, 9)
  - Open hollow arrowheads with dashed line for return calls (steps 6, 10, 11, 13)
  - Self-calls (steps 2, 8, 12) drawn as a small right-pointing arc that returns to the same lifeline
  - Each arrow labeled in monospace next to the arrow itself
  - Each arrow also has a small step number in a circle near its left endpoint (1 through 13)
  - The vertical lifelines are thin dashed grey lines
  - Time labels are NOT shown; only ordering matters

Bottom of figure: small monospace caption "Hop 5 (kb-store) is the only hop that reaches external services. All other hops are confined to the local process and the database.".

TYPOGRAPHY: serif for the top banner, sans-serif for the participant labels, monospace for arrow labels and step numbers and bottom caption. 4-6 px corner radius on participant rectangles. 1 px arrow lines, 1.5 px lifeline borders. No drop shadows. Tabular numerals."""

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

print("Submitting Gemini for Fig 4-0b (request lifecycle)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig4-0b-lifecycle.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
