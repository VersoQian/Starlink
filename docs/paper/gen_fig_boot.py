#!/usr/bin/env python3
"""Generate Fig 4-2: Server boot sequence flowchart."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic FLOWCHART showing a STRICT SERVER BOOT SEQUENCE. Aspect ratio 16:6 (wide horizontal). White background. Light pastel palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale grey (#F4F4F6), pale red (#FAE3E0). NO purple AI aesthetic, NO emojis, NO drop shadows.

Style reference: a clean linear flowchart from a systems paper. Boxes are rounded rectangles connected by directional arrows. The success path runs left-to-right horizontally. The failure path branches downward to a refuse-to-start terminal.

Top of figure: italic banner "Server boot sequence · strict configuration gate".

PRIMARY PATH (left-to-right, horizontal):
  1. START (small rounded oval, pale grey) labeled "start"
  2. STEP 1 (pale blue rounded rectangle): "embedding service health probe"
  3. STEP 2 (pale blue rounded rectangle): "database migration check"
  4. STEP 3 (pale blue rounded rectangle): "LangGraph checkpointer ensure-setup"
  5. STEP 4 (pale blue rounded rectangle): "GraphQL schema seal"
  6. STEP 5 (pale blue rounded rectangle): "SLO ring-buffer init"
  7. READY (small rounded oval, pale green, slightly stronger border) labeled "ready"

The seven nodes are connected by solid right-pointing arrows. Each step rectangle is approximately the same size; the boxes line up horizontally with consistent vertical centerline.

FAILURE PATH (branching downward from steps 1, 2, 3):
  - From STEP 1 ("embedding service health probe"), a dashed downward arrow labeled "fail"
  - From STEP 2 ("database migration check"), a dashed downward arrow labeled "fail"
  - From STEP 3 ("LangGraph checkpointer ensure-setup"), a dashed downward arrow labeled "fail"
  - All three dashed arrows converge into a single terminal node REFUSE_TO_START (pale red rounded oval) labeled "refuse to start"

The REFUSE_TO_START node sits below the horizontal primary path, roughly centered horizontally beneath steps 1-3.

Below each step rectangle, a small monospace sublabel:
  - Step 1: "probe.health()"
  - Step 2: "migrations.up()"
  - Step 3: "checkpointer.ensure()"
  - Step 4: "schema.seal()"
  - Step 5: "slo.init()"

Bottom of figure: small monospace caption "The configuration gate refuses to start with any missing mandatory environment variables.".

TYPOGRAPHY: serif for the top banner, sans-serif for step labels, monospace for sublabels and bottom caption. 6 px corner radius on step rectangles. 1.5 px solid borders on step rectangles, 2 px border on the READY oval. Dashed lines for failure-path arrows (1 px), solid lines for success-path arrows (1.2 px). No drop shadows, no emojis. Tabular numerals.

The figure should look like a single-page systems diagram with a clearly readable horizontal flow plus a downward failure branch."""

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

print("Submitting Gemini for Fig 4-2 (boot sequence)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig4-2-boot.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
