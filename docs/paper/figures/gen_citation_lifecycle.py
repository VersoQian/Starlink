#!/usr/bin/env python3
"""Generate Figure 3-7 — Citation lifecycle (five-stage provenance pipeline).

Run from this directory:
  NO_PROXY=38.98.112.79,127.0.0.1,localhost \
  HTTP_PROXY="" HTTPS_PROXY="" \
  python3 gen_citation_lifecycle.py

Cost ≈ $0.06 · 90-130s · output: fig3-7-citation-v2.png
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _nano_banana import generate

ABSTRACT = (
    "Starlink is a multi-agent business-canvas workspace that grounds every generated "
    "claim in a clickable citation chip back to the source document, and supports "
    "reverse audit from any source to every cell that cites it."
)

METHODOLOGY = (
    "Figure 3-7 traces one citation end-to-end through five horizontal stages.\n"
    "STAGE 1 - INGESTION: user uploads document (PDF / DOCX / URL) -> chunk + embed -> knowledge store.\n"
    "STAGE 2 - RETRIEVAL: hybrid retrieval (vector + lexical) returns ranked chunks. "
    "One chunk is highlighted as the match: 'stripe-s1.pdf #7 - fee model'.\n"
    "STAGE 3 - GENERATION: a product-agent emits a claim with inline citation token: "
    "'Revenue: 2.9% + $0.30 per charge [[ref:stripe-s1.pdf#7]]'.\n"
    "STAGE 4 - PARSE + STORE: citation-parser regex extracts the token into structured "
    "metadata: metadata.citations = { docId: 'stripe-s1.pdf', chunkIdx: 7 }.\n"
    "STAGE 5 - RENDER + INTERACT: canvas renders the claim with a clickable citation "
    "chip 'stripe-s1 #7'; clicking opens an evidence drawer with the cited span "
    "highlighted in yellow.\n"
    "A dashed reverse-audit arrow goes from Stage 5 back to Stage 2 labeled "
    "'reverse audit lookup - cardsReferencingEvidence(evidenceId)'."
)

PROMPT = f"""You are an expert Scientific Illustrator for top-tier AI conferences (NeurIPS/CVPR/ICML).
Your task is to generate a professional "Illustration" (main figure for the paper) based on a research paper abstract and methodology.

**Abstract:**
{ABSTRACT}

**Methodology:**
{METHODOLOGY}

**Visual Style Requirements:**
1. Style: Flat vector illustration, clean lines, academic aesthetic. Similar to figures in DeepMind or OpenAI papers. Pure white background.
2. Layout: Five horizontal stage panels, left-to-right, each labeled at the top "STAGE N - NAME". Below all five panels, a long dashed arrow curves from Stage 5 back to Stage 2.
3. Color Palette: pastel tones per stage - Stage 1 light grey (INGESTION), Stage 2 light blue (RETRIEVAL), Stage 3 sage green (GENERATION), Stage 4 soft amber (PARSE + STORE), Stage 5 pale blue (RENDER + INTERACT). Solid arrows for forward flow, dashed arrow for reverse audit.
4. Text Rendering - render these EXACT labels:
   - Stage 1: "user uploads document (PDF / DOCX / URL)" -> "chunk + embed" -> "knowledge store"
   - Stage 2: "hybrid retrieval (vector + lexical)" feeding a ranked list of three candidate chunks: "document-A.pdf #2 - overview", "stripe-s1.pdf #7 - fee model" (RED BOX HIGHLIGHTED), "api-guide.docx #14 - integration"
   - Stage 3: "agent (product-agent)" with speech bubble containing the EXACT text "Revenue: 2.9% + $0.30 per charge [[ref:stripe-s1.pdf#7]]"; small annotation "citation token inline"
   - Stage 4: "citation-parser regex" arrow into a code block displaying EXACTLY: "metadata.citations = {{ docId: 'stripe-s1.pdf', chunkIdx: 7 }}"; annotation "the parsed citation is stored as a structured field on the canvas node"
   - Stage 5: canvas card showing the claim "Revenue: 2.9% + $0.30 per charge..." with a clickable citation chip labeled "stripe-s1 #7" beside it; below the card, an evidence drawer showing source passage with the substring "2.9% + $0.30 per charge" highlighted in YELLOW
   - Bottom dashed reverse-audit arrow labeled: "reverse audit lookup - cardsReferencingEvidence(evidenceId)"
5. Negative Constraints: NO photorealistic photos, NO sketches, NO unreadable text, NO 3D shading, NO drop shadows, NO title text band, NO header at the top of the image — start directly with the five stage panels; the figure will be captioned externally by the surrounding document. Keep example data values EXACTLY as written above - do not substitute placeholders.

**Generation Instruction:**
Highlight the core novelty: the same citation token travels from agent output through the parser into structured metadata, then becomes an interactive UI element AND supports reverse audit. The dashed reverse-audit arrow at the bottom is what closes the provenance loop. Ensure connection logic and stage-to-stage arrows are visually consistent."""

if __name__ == "__main__":
    out = Path(__file__).parent / "fig3-7-citation-v2.png"
    generate(prompt=PROMPT, output_path=out)
