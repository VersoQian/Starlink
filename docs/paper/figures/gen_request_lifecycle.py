#!/usr/bin/env python3
"""Generate Figure 4-0b — Eight-hop request lifecycle (UML sequence diagram).

Run from this directory:
  NO_PROXY=38.98.112.79,127.0.0.1,localhost \
  HTTP_PROXY="" HTTPS_PROXY="" \
  python3 gen_request_lifecycle.py

Cost ≈ $0.06 · 90-130s · output: fig4-0b-lifecycle-v2.png
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _nano_banana import generate

ABSTRACT = (
    "Starlink is a multi-agent business-canvas workspace built on LangGraph with a "
    "GraphQL gateway, a knowledge-base hybrid retrieval store, a multi-agent business "
    "reasoning subgraph, and a PostgreSQL persistence layer. A single user @mention "
    "of an agent traverses these layers in a fixed eight-hop sequence."
)

METHODOLOGY = (
    "Figure 4-0b is a UML SEQUENCE DIAGRAM with seven vertical swim lanes from left "
    "to right: User, Frontend, GraphQL Gateway, mention-router, kb-store, "
    "business-langgraph, PostgreSQL. Numbered hops 1 through 13 flow downward. "
    "Solid right-pointing arrows are synchronous calls; dashed left-pointing arrows "
    "are asynchronous responses or subscriptions.\n"
    "1: User types '@market-agent ...' -> Frontend\n"
    "2: Frontend self-call: mentionAgent (UI handler)\n"
    "3: Frontend -> GraphQL Gateway: Mutation.mentionAgent\n"
    "4: GraphQL Gateway -> mention-router: resolve by callability\n"
    "5: mention-router -> kb-store: searchChunksHybrid (the only hop reaching an external service)\n"
    "6: kb-store -> mention-router (dashed): top-K chunks\n"
    "7: mention-router -> business-langgraph: invokeRegisteredAgent\n"
    "8: business-langgraph self-call: generator -> critic -> synthesizer\n"
    "9: business-langgraph -> PostgreSQL: canvas_graphs UPSERT\n"
    "10: business-langgraph -> GraphQL Gateway (dashed): conversationProgress event\n"
    "11: GraphQL Gateway -> Frontend (dashed): subscription delta\n"
    "12: Frontend self-call (dashed): applyDelta - merge by id\n"
    "13: Frontend -> User (dashed): canvas updates within one frame\n"
    "Footer caption: 'Hop 5 (kb-store) is the only hop that reaches external services. "
    "All other hops are confined to the local process and the database.'"
)

PROMPT = f"""You are an expert Scientific Illustrator for top-tier AI conferences (NeurIPS/CVPR/ICML).
Your task is to generate a professional "Illustration" (main figure for the paper) based on a research paper abstract and methodology.

**Abstract:**
{ABSTRACT}

**Methodology:**
{METHODOLOGY}

**Visual Style Requirements:**
1. Style: Flat vector UML sequence diagram, clean lines, academic aesthetic. Pure white background. Similar to architecture figures in DeepMind / OpenAI / sequence-diagram conventions used in formal software architecture papers.
2. Layout: SEVEN vertical swim lanes (vertical dashed lifelines) labeled at both top AND bottom with the participant name in a colored rounded rectangle box. Left-to-right order MUST be: User, Frontend, GraphQL Gateway, mention-router, kb-store, business-langgraph, PostgreSQL. Numbered horizontal arrows for each of the 13 hops flow downward in numerical order.
3. Color Palette: pastel rounded-rectangle participant boxes — User light grey, Frontend light blue, GraphQL Gateway light blue, mention-router sage green, kb-store sage green, business-langgraph soft amber, PostgreSQL light grey. Arrows dark grey with thin arrowheads. Solid arrows for synchronous calls (right-pointing), dashed arrows for asynchronous responses (left-pointing). Each hop has a small circled number (1) (2) (3) ... (13) at the start of its arrow.
4. Text Rendering — render exactly these labels in order, top to bottom:
   - (1) User -> Frontend: "types @market-agent ..."
   - (2) Frontend self-loop: "mentionAgent"
   - (3) Frontend -> GraphQL Gateway: "Mutation.mentionAgent"
   - (4) GraphQL Gateway -> mention-router: "resolve by callability"
   - (5) mention-router -> kb-store: "searchChunksHybrid"
   - (6) kb-store -> mention-router (dashed): "top-K chunks"
   - (7) mention-router -> business-langgraph: "invokeRegisteredAgent"
   - (8) business-langgraph self-loop: "generator -> critic -> synthesizer"
   - (9) business-langgraph -> PostgreSQL: "canvas_graphs UPSERT"
   - (10) business-langgraph -> GraphQL Gateway (dashed): "conversationProgress event"
   - (11) GraphQL Gateway -> Frontend (dashed): "subscription delta"
   - (12) Frontend self-loop (dashed): "applyDelta - merge by id"
   - (13) Frontend -> User (dashed): "canvas updates within one frame"
   - Footer caption: "Hop 5 (kb-store) is the only hop that reaches external services. All other hops are confined to the local process and the database."
5. Negative Constraints: NO photorealistic photos, NO sketches, NO unreadable text, NO 3D shading, NO drop shadows, NO title text band, NO header at the top of the image — start directly with the swim-lane participant boxes; the figure will be captioned externally by the surrounding document. Keep the sequence numbering EXACTLY 1-13 in order, and the participant names EXACTLY as listed. Self-loop arrows for hops 2, 8, 12 should be small horizontal arrows that bend back onto the same lifeline.

**Generation Instruction:**
Highlight the core novelty: hop 5 (kb-store -> external embedding API) is the only externally-reaching hop; all others stay local. Use a subtle visual emphasis (slightly bolder arrow or a small badge) on hop 5 to convey this. Ensure the left-to-right order of swim lanes is strictly preserved and the 13 hops are clearly numbered."""

if __name__ == "__main__":
    out = Path(__file__).parent / "fig4-0b-lifecycle-v2.png"
    generate(prompt=PROMPT, output_path=out)
