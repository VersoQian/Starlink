#!/usr/bin/env python3
"""Generate Fig 3-7: Citation provenance lifecycle."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic system-architecture diagram showing the END-TO-END CITATION PROVENANCE LIFECYCLE of a multi-agent business-canvas system. Light pastel palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale amber (#FCEDD7), pale grey (#F4F4F6). Plain white background. Aspect ratio 16:9. NO gradients, NO purple AI aesthetic.

The diagram is organized into FIVE STAGES arranged left to right, each in a panel with a soft pastel fill and 1px colored border. Each stage panel has a uppercase serif label at the top.

STAGE 1 · INGESTION (pale grey):
  - rounded box "user uploads document (PDF / DOCX / URL)"
  - arrow right to box "chunk + embed"
  - small cylinder "knowledge store"

STAGE 2 · RETRIEVAL (pale blue):
  - box "hybrid retrieval (vector + lexical)"
  - small ranked list of 3 chunks below it
  - one chunk highlighted in red border: "stripe-s1.pdf #7 — fee model"

STAGE 3 · GENERATION (pale green):
  - rounded box "agent (product-agent)"
  - speech-bubble style: "Revenue: 2.9 % + $0.30 per charge [[ref:stripe-s1.pdf#7]]"
  - small annotation: "citation token inline"

STAGE 4 · PARSE + STORE (pale amber):
  - rounded box "citation-parser regex"
  - arrow to small data-pill "metadata.citations = { docId, chunkIdx }"
  - the parsed citation is stored as a structured field on the canvas node

STAGE 5 · RENDER + INTERACT (pale blue, slightly wider):
  Two side-by-side sub-panels showing user interaction:
  Sub-panel A (top): a canvas card with the rendered text "Revenue: 2.9% + $0.30..." and a small chip labeled "📎 stripe-s1 #7" at the bottom. An arrow exits the chip on click.
  Sub-panel B (bottom): the evidence drawer showing the original document chunk with the cited span highlighted in red on a paper-cream background.

A DASHED REVERSE ARROW arcs back from sub-panel B all the way to STAGE 3, labeled "reverse audit lookup · cardsReferencingEvidence(evidenceId)" — meaning from any evidence chunk the user can list every canvas card that cites it.

Top of figure: italic banner "Citation lifecycle · provenance from ingestion to interaction".

Typography: clean serif for stage headers, sans-serif for box labels, monospace for citation tokens and field names. Sharp 4-6 px corner radius. 1.5px borders on stage panels, 1px on inner boxes. No drop shadows. Tabular numerals. Color accents: red ONLY on the highlighted chunk and the cited-span highlight; everything else stays in pastel + black/grey.

The figure should look like a system-paper provenance diagram with one worked example threading through all five stages."""

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

print("Submitting Gemini for Fig 3-7 (citation lifecycle)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-7-citation.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
