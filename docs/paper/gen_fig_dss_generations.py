#!/usr/bin/env python3
"""Generate Fig 2-1: Three generations of business decision-support systems."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic system-architecture diagram showing the THREE GENERATIONS of business decision-support systems. Light pastel palette: pale grey (#F4F4F6), pale blue (#E3F0FA), pale green (#E6F2E7). Plain white background. Aspect ratio 16:6 (wide horizontal). NO gradients, NO purple AI aesthetic, NO emojis. Visual style matches Figure 3-1 / Figure 3-7 of an ACL or CHI systems paper.

Three numbered generations arranged left-to-right, connected by right-pointing arrows between them. Each generation is a rounded rectangle panel containing a short title at the top and three labeled feature boxes stacked vertically below.

GENERATION 1 (pale grey panel):
  Title: "Generation 1 · Rule-based DSS"
  Three feature boxes stacked inside:
    · "aggregate structured data"
    · "templated reports"
    · "numerical summaries"

GENERATION 2 (pale blue panel):
  Title: "Generation 2 · Analytics platforms"
  Three feature boxes stacked inside:
    · "predictive · prescriptive"
    · "interactive dashboards"
    · "XAI for trust"

GENERATION 3 (pale green panel, slightly stronger border to indicate this work):
  Title: "Generation 3 · Generative DSS (this work)"
  Three feature boxes stacked inside:
    · "multi-agent analytical roles"
    · "citation-grounded output"
    · "canvas as audit surface"

Connect the three generations with two solid right-pointing arrows (G1 → G2 → G3).

Top of figure: italic banner "Three generations of business decision-support systems".
Bottom of figure: small monospace caption "Each generation moves more analytical work into the system and leaves a smaller residual to the human analyst.".

TYPOGRAPHY: clean serif for the banner, sans-serif for box labels, monospace for the caption. 4-6 px corner radius on the inner feature boxes; 8 px corner radius on the outer panels. 1.5 px borders on outer panels (Generation 3 panel uses a slightly thicker 2 px border in pale green); 1 px borders on inner boxes. No drop shadows. No emojis. Tabular numerals.

The figure should look like a clean three-stage progression diagram from a systems paper, with the third stage subtly emphasized as the contribution of this work."""

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

print("Submitting Gemini for Fig 2-1 (DSS generations)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig2-1-dss-generations.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
