#!/usr/bin/env python3
"""Generate Fig 3-5: Supervisor routing flowchart."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic flowchart diagram showing the SUPERVISOR ROUTING LOGIC of a multi-agent business-canvas system. Light pastel palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale amber (#FCEDD7), pale red (#FAE3E0). White background. Aspect ratio 16:9. NO gradients.

VISUAL STYLE NOTE: every rectangle that names a specific AGENT must include a SMALL ROLE ICON in a colored circle at the left edge of the rectangle, in the same visual style as MetaGPT Figure 1 (Hong et al.) — flat, abstract, monochrome line glyphs, NOT humanoid faces. The agent roles and their icons are SHARED ACROSS ALL FIGURES IN THIS PAPER:

  · supervisor   → router/branch-arrows icon (pale blue circle)
  · market       → bar-chart icon (pale green circle)
  · product      → box/package icon (pale green circle)
  · finance      → coin icon (pale green circle)
  · critic       → magnifying-glass icon (pale amber circle)
  · synthesizer  → puzzle-piece icon (pale amber circle)
  · opponent     → crossed-arrows icon (pale red circle)
  · moderator    → gavel icon (pale blue circle, marking its judging role)

The flowchart shows the algorithm step by step from top to bottom. Use rounded rectangles for actions, diamonds for decisions, and labeled arrows. The diagram should fit comfortably in landscape.

START at the top: a small rounded oval "user query".

Step 1 (rectangle, pale blue) WITH SUPERVISOR ICON: "Supervisor.classifyIntent"
  - subtitle: "five callability classes"
  - Arrow down to:

DECISION DIAMOND 1 (pale grey): "intent type?"
  - Branch right (label "utility / report"): rectangle "dispatch to utility/report agent" with a small chat-bubble icon, then short branch to END
  - Branch down (label "bmc-generator"): continue

Step 2 (rectangle, pale green) WITH THREE AGENT ICONS (bar-chart + box + coin clustered at the left edge): "fan-out to {market, product, finance}"
  - subtitle: "parallel writes to blackboard slots"
  - Arrow down

Step 3 (rectangle, pale amber) WITH CRITIC AND SYNTHESIZER ICONS (magnifier + puzzle-piece clustered at the left edge): "sequence advisors: critic → synthesizer"
  - subtitle: "critic writes conflicts; synthesizer writes insights"
  - Arrow down

DECISION DIAMOND 2 (pale red): "any high-severity conflict AND round < 3?"
  - Branch right (yes): rectangle "fan-out to opponents · moderator returns verdict" WITH CROSSED-ARROWS AND GAVEL ICONS clustered at the left edge
    - This rectangle has an arrow LOOPING BACK UP to Step 2 ("re-run generators with verdict")
    - The looping arrow is labeled "round + 1 · max 3"
  - Branch down (no): rectangle "synthesizer commits final canvas" WITH PUZZLE-PIECE ICON at the left edge

END: a small rounded oval "final canvas + citations".

Loop annotation: place a small horizontal label "Bounded supervisor loop · max 3 rounds" ABOVE the looping arrow between the conflict diamond and the fan-out step. Do NOT add any rotated/vertical text strips. Do NOT repeat the loop label.

Below the diagram: a tiny CENTERED note in monospace "Algorithm 3 · SupervisorDispatch".

Top of figure: italic banner "Supervisor routing & bounded adversarial review".

Typography: clean serif for the banner, sans-serif for box labels, monospace for technical sub-labels. Sharp 4-6 px corner radius on rectangles; standard diamond for decisions. 1.5px solid borders on decision diamonds, 1px on rectangles. NO drop shadows. NO humanoid faces, NO cartoon avatars. Icons are flat single-color line glyphs in academic system-paper style. Tabular numerals.

The agent icons make the flowchart visually consistent with Figure 3-3 (twelve-agent topology) — the SAME agent identities use the SAME icons across the paper."""

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

print("Submitting Gemini for Fig 3-5 (supervisor routing flowchart)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-5-supervisor.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
