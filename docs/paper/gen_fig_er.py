#!/usr/bin/env python3
"""Generate Fig 4-1: 14-table persistence schema ER diagram."""
import json, requests, time, os, sys

API_SUBMIT = "http://38.98.112.79/df-ability-server/task/v1/submit"
API_STATUS = "http://38.98.112.79/df-ability-server/task/v1/status/{}"
HEADERS = {"x-df-ability":"df-ability-google-gemini","x-df-access-key":"yunying","x-df-secret-key":"ths123456","Content-Type":"application/json"}
POLL_HEADERS = {k:v for k,v in HEADERS.items() if k!="Content-Type"}

PROMPT = """A clean academic ENTITY-RELATIONSHIP (ER) diagram showing a SIMPLIFIED 14-TABLE PERSISTENCE SCHEMA. Aspect ratio 16:10. White background. Light pastel palette grouped by four functional domains: pale blue (#E3F0FA) for user/session, pale green (#E6F2E7) for canvas/knowledge, pale amber (#FCEDD7) for LangGraph state, pale grey (#F4F4F6) for observability/security. NO purple AI aesthetic, NO emojis, NO drop shadows.

Visual style: a Chen-style or crow's-foot ER diagram with rounded rectangles for entities, labeled relationship lines, and three named entities shown with their key columns expanded.

Top of figure: italic banner "Simplified ER view · 14-table persistence schema across 4 functional domains".

ENTITIES grouped into four colored regions (each region labeled at the top with a small title strip):

DOMAIN 1 · User / Session (pale blue panel, top-left):
  - CONVERSATION_SESSIONS  (entity rectangle, expanded with columns: id PK · status · workspace_id FK)
  - CONVERSATION_MESSAGES
  - HANDOFF_EVENTS

DOMAIN 2 · Canvas / Knowledge (pale green panel, top-right):
  - WORKSPACE_METADATA
  - CANVAS_GRAPHS
  - KB_DEFINITIONS
  - KB_DOCUMENTS
  - KB_CHUNKS  (entity rectangle, expanded with columns: id PK · doc_id FK · chunk_index · content · embedding VECTOR(1536) · workspace_id FK · visibility)
  - KB_AGENT_BINDINGS
  - MEMORY_ITEMS

DOMAIN 3 · LangGraph State (pale amber panel, bottom-left):
  - CHECKPOINTS  (entity rectangle, expanded with columns: thread_id PK · state · updated_at)
  - CHECKPOINT_WRITES
  - CHECKPOINT_BLOBS

DOMAIN 4 · Observability / Security (pale grey panel, bottom-right):
  - AGENT_SLO_TOTALS
  (+ implicit row-level-security policies, shown as a small chip)

RELATIONSHIP LINES (crow's-foot notation):
  - CONVERSATION_SESSIONS ──< CONVERSATION_MESSAGES  (label: "has")
  - CONVERSATION_SESSIONS ──< HANDOFF_EVENTS  (label: "emits")
  - WORKSPACE_METADATA ──< CANVAS_GRAPHS  (label: "owns")
  - WORKSPACE_METADATA ──< KB_DEFINITIONS  (label: "owns")
  - WORKSPACE_METADATA ──< MEMORY_ITEMS  (label: "owns")
  - KB_DEFINITIONS ──< KB_DOCUMENTS  (label: "contains")
  - KB_DOCUMENTS ──< KB_CHUNKS  (label: "splits into")
  - KB_DEFINITIONS ──< KB_AGENT_BINDINGS  (label: "bound to")
  - CONVERSATION_SESSIONS ──< CHECKPOINTS  (label: "thread_id")
  - CHECKPOINTS ──< CHECKPOINT_WRITES  (label: "pending")
  - CHECKPOINTS ──── CHECKPOINT_BLOBS  (label: "blob", one-to-one)
  - AGENT_SLO_TOTALS ────│ WORKSPACE_METADATA  (label: "per-workspace")

Bottom of figure: small monospace caption "All four domains share a `workspace_id` column for tenant isolation, enforced by PostgreSQL Row Security policies.".

TYPOGRAPHY: serif for the top banner and domain titles, sans-serif for entity names, monospace for column names and types. 4 px corner radius on entity rectangles. 1 px borders. The three expanded entities (CONVERSATION_SESSIONS, KB_CHUNKS, CHECKPOINTS) are shown with their column lists; the other entities are shown as smaller named-only rectangles. Relationship lines are 1px solid grey with small crow's-foot terminators at the many-side ends. No drop shadows. No emojis. Tabular numerals."""

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

print("Submitting Gemini for Fig 4-1 (14-table ER)...")
data = submit_retry(); t = data.get("data",{}).get("task_id")
if not t: sys.exit("no task_id")
result = poll_retry(t); rs = result.get("result","")
img = result.get("imageUrl") or (rs if isinstance(rs,str) and rs.startswith("http") else None)
if not img and isinstance(rs,str):
    try: img = json.loads(rs).get("imageUrl") or json.loads(rs).get("url")
    except: pass
if not img: print(json.dumps(result,indent=2)[:800]); sys.exit("no URL")
out = "/Users/sheng/git/video/Starlink/docs/paper/figures/fig4-1-er.png"
for a in range(5):
    try:
        ir = requests.get(img, timeout=120)
        with open(out,"wb") as f: f.write(ir.content)
        print(f"Saved: {out} ({len(ir.content)} bytes)"); sys.exit(0)
    except requests.exceptions.RequestException: time.sleep(5*(a+1))
sys.exit("download failed")
