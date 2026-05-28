#!/usr/bin/env python3
"""Generate Fig 3-3: 12-agent topology, MetaGPT/Meflex style."""
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

PROMPT = """A clean academic system-architecture diagram in the visual style of MetaGPT Figure 1 (Hong et al., arXiv 2308.00352): every agent has a visible ROLE ICON in a small colored circle, in addition to its name. Light pastel color palette: pale blue (#E3F0FA), pale green (#E6F2E7), pale amber (#FCEDD7), pale red (#FAE3E0), pale grey (#F4F4F6). Plain white background. Aspect ratio 16:9. NO gradients, NO purple AI aesthetic.

The diagram shows the TWELVE-AGENT TOPOLOGY of a multi-agent business-canvas system, organized into FIVE FUNCTIONAL BANDS arranged top-to-bottom. Each band is its own horizontal panel with a soft pastel fill and a thin 1px colored border. A small monospace band-label sits on the left edge of each band: "BAND 1 · ROUTER", "BAND 2 · BMC GENERATORS", "BAND 3 · ADVISORS", "BAND 4 · ADVERSARIAL REVIEW", "BAND 5 · UTILITIES". Each band's pastel fill differs.

EVERY AGENT BOX is shown the same way: at the left edge of the box, a 28-px circle filled with the band color holds a SIMPLE LINE ICON depicting the agent's role (NOT a humanoid face — use abstract role-symbolic icons that look like academic-paper iconography). To the right of the icon, the agent name in sans-serif. Below the name, a small monospace subtitle. The icon list per agent:

  Band 1 — Router (pale blue circles):
    · Supervisor → icon = a small router/diamond symbol with 3 branching arrows (subtitle "callability: 5 classes")

  Band 2 — BMC generators (pale green circles):
    · Market   → icon = a small bar-chart silhouette       (subtitle "capability: CS · CH · CR")
    · Product  → icon = a small box / package outline       (subtitle "capability: VP · KR · KA · KP")
    · Finance  → icon = a small dollar / coin glyph         (subtitle "capability: RS · CO")

  Band 3 — Advisors (pale amber circles):
    · Critic       → icon = a small magnifying-glass        (subtitle "strict structured output")
    · Synthesizer  → icon = a small puzzle-piece            (subtitle "cross-cell insights")

  Band 4 — Adversarial review (pale red circles):
    · Market-opp   → icon = a small crossed-arrows symbol   (subtitle "challenges market claims")
    · Product-opp  → icon = a small crossed-arrows symbol   (subtitle "challenges product claims")
    · Finance-opp  → icon = a small crossed-arrows symbol   (subtitle "challenges finance claims")
    · Moderator    → icon = a small gavel                   (subtitle "issues verdict"; this agent is in band 4 but uses pale blue circle to mark its judging role)

  Band 5 — Utilities (pale grey circles):
    · General-responder → icon = a small chat-bubble        (subtitle "low-tier replies")
    · Deep-research     → icon = a small spyglass / telescope (subtitle "long-running search")
    · Report-writer     → icon = a small document with lines  (subtitle "PDF / Word export")

CRITICAL — NEVER print the placeholder string "(no subtitle)" anywhere. Every agent box has the subtitle text specified above; that subtitle text is the literal content to render below the agent name.

In the EXACT CENTER of the figure (overlapping bands 2 and 3 graphically), a horizontal cylinder/database shape labeled "shared blackboard (Annotation.Root)" with sub-label "typed slots · per-slot reducers". The cylinder spans about 50% of the figure width.

Arrows showing flow:
  - Solid arrows from "Supervisor" (band 1) DOWN to each of the 3 generators (band 2) labeled "dispatch"
  - Dashed arrows from each generator and each advisor DOWN INTO the blackboard cylinder labeled "write/read"
  - Solid arrows from band 3 (Critic) DOWN to band 4 opponents only when "severity = high" — annotate this arrow as "conditional · high-severity"
  - Solid arrows from each opponent UP to the respective generator (label "challenge")
  - Solid arrow from Moderator UP to Supervisor labeled "verdict"
  - Band 5 sits separate, with dashed arrow to blackboard labeled "utility writes"

Right side margin: a tall narrow legend strip with chip-shaped color samples and tiny labels: "● router · ● generator · ● advisor · ● debate · ● utility".

Top of figure: small italic banner "Starlink · 12-agent topology". Bottom of figure: a tiny note "Each agent = one LangGraph subgraph".

Typography: clean serif for band headers, sans-serif for agent names, monospace for capability bindings and subtitles. Sharp 4px corner radius on agent boxes, 6px on band panels. 1.5px solid borders only on the Supervisor (band 1 leader); 1px elsewhere. NO drop shadows. NO photo-realistic faces, NO cartoon humans. The icons must be flat, abstract, single-color line glyphs in the spirit of academic system-paper icons (think NeurIPS / CHI figure iconography). Tabular numerals.

The figure should have visual character similar to MetaGPT Figure 1 — every agent has a small role icon that makes the multi-agent nature visceral — but kept in academic monochrome iconography rather than cartoonish avatars.

CRITICAL — DO NOT print any attribution, credit, or source citation INSIDE the rendered image. This is an original Starlink figure. Specifically FORBIDDEN strings anywhere in the rendered image: "MetaGPT", "Hong et al.", "arXiv", "2308.00352", "Figure 1", "Inspired by", "Adapted from", "Based on", any reference numbers like "[1]", "[27]", any DOI strings. The only text inside the image is the banner at the top, the band labels, the agent boxes, the blackboard cylinder label, the arrow labels, the legend, and the small note at the bottom — and nothing else."""

def submit_retry():
    for a in range(5):
        try:
            r = requests.post(API_SUBMIT, headers=HEADERS, json={"model":"gemini-3-pro-image-preview","contents":[{"parts":[{"text":PROMPT}]}]}, timeout=60)
            return r.json()
        except requests.exceptions.RequestException as e:
            print(f"[submit {a+1}/5] {type(e).__name__}"); time.sleep(5*(a+1))
    sys.exit("submit failed")

def poll_retry(task_id, mx=80):
    for a in range(mx):
        time.sleep(6)
        try:
            r = requests.get(API_STATUS.format(task_id), headers=POLL_HEADERS, timeout=60)
            d = r.json(); s = d.get("data",{}).get("status","?")
            print(f"[{a:02d}] {s}")
            if s == "FINISHED": return d["data"]
            if s in ("FAILED","ERROR"): print(json.dumps(d,indent=2)[:600]); sys.exit(2)
        except requests.exceptions.RequestException: continue
    sys.exit("timeout")

print("Submitting Gemini for Fig 3-3 (12-agent topology)...")
data = submit_retry()
task_id = data.get("data",{}).get("task_id")
if not task_id: sys.exit("no task_id")
result = poll_retry(task_id)
rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")

out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-3-topology.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)")
        sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
