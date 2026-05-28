#!/usr/bin/env python3
"""Generate Fig 4-3: Canvas viewport mockup in MetaGPT/Meflex screenshot style."""
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

PROMPT = """A realistic UI mockup screenshot of a business-analysis web application called "Starlink", styled like Figure 1 of an HCI / CHI paper. Aspect ratio 16:9. White / off-white desktop background, suggesting macOS browser viewport at 1440×900. NO gradients, NO purple AI aesthetic, NO glassmorphism. Editorial / consulting-boardroom feel.

CENTER of viewport: An infinite-canvas workspace showing the nine cells of a Business Model Canvas laid out in a 3 × 3 grid. Each cell is a rounded rectangle with a thin 1.5px navy (#1f4f8b) border on a pale paper background (#FAF7F0). Each cell has:
  - A small uppercase monospace label in the top-left corner naming the dimension: CS (customer segments), VP (value propositions), CH (channels), CR (customer relationships), RS (revenue streams), KR (key resources), KA (key activities), KP (key partnerships), CO (cost structure)
  - A short 2-3 line plain-text content block in serif font (Fraunces) describing a specific business model fragment (use realistic business strategy wording such as "Two-sided marketplace for B2B SaaS buyers", "Subscription + per-seat tier", "Self-serve onboarding + sales-led upgrade", "Engineering payroll · cloud infra", etc.)
  - One or two small "🔖" or generic-chip-shaped citation chips at the bottom of the text (small colored rectangles labeled like "stripe-s1.pdf #7")

BETWEEN TWO CELLS in the middle row: a thin dashed red edge labeled "conflict · medium" linking the KEY_RESOURCES cell to the KEY_ACTIVITIES cell, with a small red dot at each endpoint.

LEFT SIDE of viewport (floating overlay panel anchored to the canvas):
  - A "CanvasChatDock" rectangle showing 2-3 chat bubbles. Bottom of dock has an input field with placeholder "@market-agent ..."
  - Above the dock: a smaller "CanvasLiveCoach" rectangle showing 2 small Socratic question chips like "Have you tested customer pain?" and "How do you measure activation?"

RIGHT SIDE of viewport (floating overlay panel):
  - A "CanvasCitationPanel" rectangle with 4 small tabs at the top: Evidence · Memory · Review · Status
  - Below the tabs, list 2 evidence chips with document name + chunk index
  - Below the panel: a "CCBMCDetailDrawer" rectangle showing a cell's expanded markdown content

BOTTOM RIGHT of viewport: a small "AgentHealth" indicator chip showing 3 colored dots labeled "● SLO" "p95: 142ms" "err: 0.2%", with monospace font.

TOP of viewport: a thin browser-chrome header showing the URL /canvas/<workspace-id> in mono font, and a small breadcrumb "Starlink · Workspace · Canvas".

Use the editorial color palette only: ink-black (#0A0A0A), paper-cream (#FAF7F0, #F4F0E8), navy accent (#1f4f8b), red accent (#B33028) ONLY on the conflict edge and one chip. Per-agent kicker colors very subtle (warm sage / muted blue / muted clay). All numerals tabular (JetBrains Mono). Sharp 4px corner radius on cells, 6px on overlays. 1.5px solid borders, no drop shadows.

The screenshot should look like a real running application, not a Figma mockup — like Figure 1 of a CHI paper that shows an actual deployed system."""

def submit_with_retry():
    for attempt in range(5):
        try:
            r = requests.post(API_SUBMIT, headers=HEADERS, json={
                "model": "gemini-3-pro-image-preview",
                "contents": [{"parts": [{"text": PROMPT}]}],
            }, timeout=60)
            return r.json()
        except requests.exceptions.RequestException as e:
            print(f"[submit {attempt+1}/5] {type(e).__name__}")
            time.sleep(5 * (attempt + 1))
    sys.exit("submit failed")

def poll_with_retry(task_id, max_attempts=80):
    for attempt in range(max_attempts):
        time.sleep(6)
        try:
            r = requests.get(API_STATUS.format(task_id), headers=POLL_HEADERS, timeout=60)
            data = r.json()
            status = data.get("data", {}).get("status", "?")
            print(f"[{attempt:02d}] {status}")
            if status == "FINISHED": return data["data"]
            if status in ("FAILED", "ERROR"):
                print(json.dumps(data, indent=2)[:600]); sys.exit(2)
        except requests.exceptions.RequestException:
            continue
    sys.exit("timeout")

print("Submitting Gemini job for Fig 4-3 (canvas viewport mockup)...")
data = submit_with_retry()
task_id = data.get("data", {}).get("task_id")
if not task_id: sys.exit("no task_id")

result = poll_with_retry(task_id)
result_str = result.get("result", "")
img_url = result.get("imageUrl") or (result_str if isinstance(result_str, str) and result_str.startswith("http") else None)
if not img_url and isinstance(result_str, str):
    try: img_url = json.loads(result_str).get("imageUrl") or json.loads(result_str).get("url")
    except: pass
if not img_url: print(json.dumps(result, indent=2)[:800]); sys.exit("no URL")

out_path = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig4-3-canvas-viewport.png"
for attempt in range(5):
    try:
        ir = requests.get(img_url, timeout=120)
        with open(out_path, "wb") as f: f.write(ir.content)
        print(f"Saved: {out_path} ({len(ir.content)} bytes)")
        sys.exit(0)
    except requests.exceptions.RequestException:
        time.sleep(5 * (attempt + 1))
sys.exit("download failed")
