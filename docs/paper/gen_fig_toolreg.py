#!/usr/bin/env python3
"""Generate Fig 3-4: Tool registry and agent-tool bindings."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic system diagram in the style of Figure 2 of Gao et al.'s RAG survey (arXiv 2312.10997): white background, monochrome light-blue palette with ONE accent color reserved for the novel/load-bearing element, clean rounded rectangles, no drop shadows, no gradients, no purple AI aesthetic, NO emojis.

PURPOSE: show TOOL REGISTRY and AGENT-TOOL BINDINGS of a multi-agent business-canvas system. Aspect ratio 16:9.

CRITICAL CORRECTNESS RULES (the previous render had a duplication bug — DO NOT repeat):
  - Every tool name appears EXACTLY ONCE. Do NOT duplicate any tool (no second "file_reader", no second "sentiment", no second "analyses" header).
  - The middle column has EXACTLY 11 generic tools, not more.

LAYOUT — three vertical columns separated by thin grey dividers:

COLUMN 1 (left, ~22% width, pale blue panel #E3F0FA with 1px border):
  Header: "AGENTS" (uppercase serif).
  Six rounded rectangles stacked vertically with 14px gap, all uniform size:
    1. supervisor          [callability: supervisory]
    2. market-agent        [callability: bmc-generator]
    3. product-agent       [callability: bmc-generator]
    4. finance-agent       [callability: bmc-generator]
    5. critic              [callability: advisor]
    6. deep-research       [callability: investigative]
  All agent boxes share the SAME light blue fill #E3F0FA; small monospace subtitle in #555.

COLUMN 2 (middle, ~28% width, pale grey panel #F4F4F6 with 1px border):
  Header: "GENERIC TOOLS" (uppercase serif).
  TWO sub-groups separated by a horizontal hairline:
    Sub-group "data sources" (7 boxes, in one column):
      knowledge_base · web_search · url_fetch · memory_search · file_reader · api_connector · database_query
    Sub-group "analyses" (4 boxes, in one column):
      sentiment · keyword_extract · risk_assessment · competitive_compare
  All tool boxes share the same white fill with 1px grey border; tool names in monospace. NO color variation within this column.

COLUMN 3 (right, ~38% width, pale green panel #E6F2E7 with 1px border):
  Header: "DIMENSION-ACTIONS" (uppercase serif).
  Nine rounded rectangles for the nine BMC dimensions, grouped by semantic family with subtle 2px-thick vertical bands on the LEFT EDGE of each box (the band color is the ONLY semantic color in this column):
    - market-facing (band color: pale teal #B8DDD9): customer-segments · channels · customer-relationships
    - product-facing (band color: pale moss #C8D9B5): value-propositions · key-resources · key-activities · key-partnerships
    - finance-facing (band color: pale ochre #E0CFA3): revenue-streams · cost-structure
  Inside each dimension box, three small uniform chips in a row showing the three action verbs: "analyze | generate | validate".

BINDINGS — arrows from Column 1 to Columns 2 and 3:
  - supervisor → web_search, knowledge_base, memory_search, url_fetch (grey 1px arrows)
  - market-agent → knowledge_base, web_search; AND market-facing dimensions (CS, CH, CR) (blue 1.2px arrows)
  - product-agent → knowledge_base, web_search; AND product-facing dimensions (VP, KR, KA, KP) (green 1.2px arrows)
  - finance-agent → knowledge_base, web_search; AND finance-facing dimensions (RS, CO) (amber 1.2px arrows)
  - critic → sentiment, keyword_extract, risk_assessment, competitive_compare (grey dashed 1px arrows)
  - deep-research → database_query, web_search, knowledge_base (grey 1px arrows)

ARROW DISCIPLINE:
  - All arrows enter the LEFT side of the target box and exit the RIGHT side of the source box.
  - Bundle arrows that share endpoints into smooth gentle curves; minimise crossings.
  - Arrowheads are small (≤ 6 px), filled triangles.

LEGEND (bottom right, in a thin grey-bordered box, ~20% width):
  "Arrow color codes the calling agent. Each arrow = one declared capability bound at startup. Capability declarations are static (set at agent registration) and cannot be skipped at runtime — this is what 'declarative coverage' means."

TOP banner (italic serif, dark grey):
  "Tool registry · agent–tool bindings (declarative coverage)"

BOTTOM caption (small monospace, light grey, centred):
  "Each agent ⇄ {generic tools, dimension actions} binding shown above is one row of the capability matrix in Table 3-2."

TYPOGRAPHY: clean serif for the banner only; sans-serif for headers and box labels; monospace for tool names and code-like identifiers. Sharp 4–6 px corner radius. 1.5 px borders on column panels, 1 px on inner boxes. NO drop shadows. Tabular numerals.

The figure should answer at a glance: which agent calls which tool. Color should encode AGENT IDENTITY (on arrows) and BMC SEMANTIC FAMILY (on dimension box bands) — and nothing else. Tools themselves are not color-coded."""

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

print("Submitting Gemini for Fig 3-4 (tool registry)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig3-4-toolreg.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
