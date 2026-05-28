#!/usr/bin/env python3
"""Generate Fig 3-6: One round of adversarial review."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic system diagram showing ONE ROUND of the BOUNDED ADVERSARIAL REVIEW LOOP in a multi-agent business-canvas system. Light pastel palette: pale red (#FAE3E0), pale amber (#FCEDD7), pale green (#E6F2E7), pale blue (#E3F0FA). White background. Aspect ratio 16:9. NO gradients.

VISUAL STYLE NOTE: every agent rectangle includes a SMALL ROLE ICON in a colored circle at the left edge, in the same visual style as MetaGPT Figure 1 — flat, abstract, monochrome line glyphs, NOT humanoid faces. The agent icons are CONSISTENT WITH OTHER FIGURES IN THIS PAPER:

  · critic               → magnifying-glass icon (pale amber circle)
  · market-agent         → bar-chart icon (pale green circle)
  · product-agent        → box/package icon (pale green circle)
  · finance-agent        → coin icon (pale green circle)
  · market-opp, product-opp, finance-opp → crossed-arrows icon (pale red circle)
  · moderator            → gavel icon (pale blue circle)

The diagram is centered horizontally, with a clear ENTRY at the top, four central agent boxes in two rows, and an EXIT at the bottom. Visual register similar to MetaGPT Figure 1 or Magentic-One Figure 2.

TOP: A rounded box WITH A MAGNIFYING-GLASS CRITIC ICON labeled "Critic flagged high-severity conflict" with subtitle "between two dimensions, e.g., KEY_RESOURCES vs KEY_ACTIVITIES" — pale amber fill.

Below it, an arrow pointing down splits into THREE parallel branches, each routing to a different opponent:

  - LEFT BRANCH: rounded box WITH CROSSED-ARROWS ICON "market-opponent" (pale red fill) with subtitle "challenges market-facing claims"
  - MIDDLE BRANCH: rounded box WITH CROSSED-ARROWS ICON "product-opponent" (pale red fill) with subtitle "challenges product-facing claims"
  - RIGHT BRANCH: rounded box WITH CROSSED-ARROWS ICON "finance-opponent" (pale red fill) with subtitle "challenges finance-facing claims"

Each opponent box has TWO outgoing arrows:
  - One UP arrow back to the original generator (market-opp → market-agent box; similarly for product and finance) — labeled "counter-claim with anchor"
  - One DOWN arrow to a shared "Moderator" box at the bottom — labeled "argument + counter-argument"

In the middle-right area (alongside the opponents row), three small generator boxes (pale green) WITH THEIR ROLE ICONS: "market-agent" (bar-chart icon), "product-agent" (box icon), "finance-agent" (coin icon) — receiving the counter-claims from their opponent.

At the BOTTOM CENTER: a rounded box WITH GAVEL ICON labeled "Moderator" (pale blue fill). Below it: a diamond decision "accept proposed resolution?"
  - YES branch (right): rounded box "commit verdict to blackboard" → arrow exiting bottom right with label "round done · ≤ 3 total"
  - NO branch (left): arrow looping back up to the entry, labeled "round + 1"

Right margin: thin vertical strip annotating "Bounded · max 3 rounds · halts on accept OR round-cap".

Top of figure: italic banner "Adversarial review · one round (bounded · 3 rounds max)". Bottom: small note in monospace "Triggered ONLY when Critic returns severity = high".

Typography: clean serif for the banner, sans-serif for box labels, monospace for technical sub-labels. Sharp 4-6 px corner radius on rectangles. 1.5px borders on opponents (the adversarial role gets stronger borders). NO drop shadows. NO humanoid faces, NO cartoon avatars. Icons are flat single-color line glyphs.

The diagram should clearly show: (a) trigger condition (critic), (b) three-way fan-out (opponents), (c) generator-opponent pairing (agents), (d) moderator verdict (gavel), (e) bounded looping. The agent icons make this figure visually consistent with Figure 3-3 (twelve-agent topology) — the SAME agent identities use the SAME icons across the paper."""

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

print("Submitting Gemini for Fig 3-6 (debate round)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-6-debate.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
