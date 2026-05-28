#!/usr/bin/env python3
"""Generate Fig 3-8: Bilingual hybrid retrieval pipeline."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic system-architecture diagram in the style of Figure 3 of Gao et al.'s RAG survey. Light pastel color palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale grey (#F4F4F6). White background. Aspect ratio 16:9. NO gradients, NO purple, NO AI-slop.

The diagram shows the BILINGUAL HYBRID RETRIEVAL pipeline of a multi-agent system. The diagram has THREE horizontal stages from left to right:

STAGE 1 · INGESTION (pale grey panel):
  - A rounded box "user uploads document" with a small icon suggestion (PDF / DOCX / URL labels stacked)
  - Arrow right to a box "chunk + embed"
  - A small cylinder/database labeled "knowledge store"
  - A note in italic monospace: "chunk size ≈ 600 chars · paragraph-first"

STAGE 2 · DUAL-CHANNEL RETRIEVAL (the centerpiece — wider than the other stages, pale blue panel):
  - TWO parallel lanes labeled at the top: "Dense Vector Channel" (left lane, slightly darker blue accent) and "Unicode-class Lexical Channel" (right lane, slightly darker green accent)
  - In the dense lane (top to bottom): box "embedding service (commercial)" with a small dashed fallback to "deterministic local hash"; below that: box "pgvector cosine similarity"; below: a small ranked list of 5 document chunks with cosine scores
  - In the lexical lane (top to bottom): box "tokenizeForLexical()" with note "CJK bigrams · Latin words ≥ 3 chars · Unicode-class detection"; below: box "substring match on stored chunks"; below: a small ranked list of 5 document chunks with hit counts
  - At the bottom of stage 2: a hexagonal/diamond shape labeled "Reciprocal Rank Fusion (RRF)" that receives both lanes' ranked lists. Below it: equation "score(d) = Σ 1 / (k + rank_r(d))" in monospace, with "k = 60" annotated.

STAGE 3 · OUTPUT (pale green panel):
  - A small fused ranked list of "top-K = 3 chunks" with their final fusion scores
  - Arrow exiting to the right edge labeled "to invoking agent"

Between stages: thin grey vertical dividers.

Dashed arrows showing two failure modes annotated in red text in a thin margin: (a) embedding service jitter → "lexical channel carries recall", (b) bilingual user query → "Unicode-class tokenizer detects script automatically".

Top of figure: italic banner "Bilingual hybrid retrieval pipeline". Bottom: a tiny note "Dual-channel fusion serves as reliability safeguard, not quality lift, under healthy operation".

Typography: clean serif for stage headers, sans-serif for body labels, monospace for code identifiers and equations. Sharp 4-6 px corner radius. 1.5px borders on stage panels, 1px on inner boxes. Tabular numerals. No emojis, no drop shadows. The figure should look like an accepted ACL or SIGIR system paper figure."""

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

print("Submitting Gemini for Fig 3-8 (hybrid retrieval pipeline)...")
data = submit_retry(); task_id = data.get("data",{}).get("task_id")
if not task_id: sys.exit("no task_id")
result = poll_retry(task_id); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")

out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-8-retrieval.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
