#!/usr/bin/env python3
"""Generate Figure 3-1 — Starlink three-pillar system architecture via NanoBanana.

Run from this directory:
  NO_PROXY=38.98.112.79,127.0.0.1,localhost \
  HTTP_PROXY="" HTTPS_PROXY="" \
  python3 gen_arch.py

Cost ≈ $0.06 · 90-130s · output: fig-arch-starlink.png
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from _nano_banana import generate

ABSTRACT = (
    "The Business Model Canvas (BMC) is a structured analytical framework with nine "
    "interrelated dimensions. The dominant single-LLM-call paradigm exhibits structural "
    "limitations that hold independently of model capability: coverage is probabilistic, "
    "evidence binding is not declarable, and the process is neither inspectable nor "
    "addressable. Starlink proposes declarative coverage as the design principle and "
    "realizes it as a deployable multi-agent business-canvas workspace."
)

METHODOLOGY = (
    "Starlink has three co-equal architectural pillars and an observability stack.\n"
    "PILLAR 1 — LangGraph Multi-Agent Reasoning Core: twelve specialized agents in five "
    "functional bands — 1 Supervisor, 3 domain Generators (Market-Agent, Product-Agent, "
    "Finance-Agent), 2 Advisors (Critic, Synthesizer), a 4-agent Debate Loop bounded to "
    "≤3 rounds (Opponent-M, Opponent-P, Opponent-F, Moderator), and 3 Utilities (Chat, "
    "Deep-Research, Translator). All agents communicate only through a Shared Blackboard "
    "(BusinessState), never agent-to-agent. Each Generator is bound at boot time to a "
    "subset of the 9 BMC dimensions via declarative capability declaration.\n"
    "PILLAR 2 — Bilingual Hybrid Retrieval: a Dense Vector channel (pgvector) and a "
    "Lexical Tokenizer channel (Unicode-class-aware, CJK + Latin) fused via Reciprocal "
    "Rank Fusion (RRF). Returns typed citations into the blackboard.\n"
    "PILLAR 3 — Canvas-first Frontend (React Flow): renders a 3x3 grid of nine BMC cells "
    "(CS, VP, CH, CR, RS, KR, KA, KP, CO) with clickable citation chips and reverse-audit. "
    "Four floating overlays: Chat, Citation panel, Cell detail, Agent SLO.\n"
    "OBSERVABILITY STACK: bottom strip with three SLO boxes — Agent SLO, Tool SLO, "
    "Mention SLO — feeding a Health overlay on the canvas.\n"
    "CORE NOVELTY: declarative coverage. Capability declaration at boot guarantees each "
    "BMC dimension is dispatched regardless of how the underlying LLM allocates attention."
)

PROMPT = f"""You are an expert Scientific Illustrator for top-tier AI conferences (NeurIPS/CVPR/ICML).
Your task is to generate a professional "Illustration" (main figure for the paper) based on a research paper abstract and methodology.

**Abstract:**
{ABSTRACT}

**Methodology:**
{METHODOLOGY}

**Visual Style Requirements:**
1. Style: Flat vector illustration, clean lines, academic aesthetic. Similar to figures in DeepMind or OpenAI papers.
2. Layout: Organized flow Left-to-Right with a central Shared Blackboard hub. Group related components into colored panels: light-blue panel for Reasoning Core (left/center), sage-green panel for Hybrid Retrieval (right of core), light-amber panel for Canvas Frontend (rightmost), thin grey strip at bottom for Observability.
3. Color Palette: Professional pastel tones only — muted blue, sage green, soft amber, light grey. White background. Dark grey arrows and text. No saturated colors.
4. Text Rendering: You MUST include legible text labels for these key modules: "Supervisor", "Shared Blackboard (BusinessState)", "Market-Agent", "Product-Agent", "Finance-Agent", "Critic", "Synthesizer", "Debate Loop (<=3 rounds)", "Moderator", "Chat", "Deep-Research", "Translator", "Dense Vector (pgvector)", "Lexical Tokenizer (CJK + Latin)", "RRF Fusion", "Canvas (React Flow)", "Citation chip", "Agent SLO", "Tool SLO", "Mention SLO". Use short labels. Show the nine BMC cells as a 3x3 grid labeled CS VP CH CR RS KR KA KP CO.
5. Negative Constraints: NO photorealistic photos, NO messy sketches, NO unreadable text, NO 3D shading artifacts, NO drop shadows, NO decorative artwork, NO emoji, NO title text band, NO header text at the top of the image — start directly with the architecture content; the figure will be captioned externally by the surrounding document.

**Generation Instruction:**
Highlight the core novelty: declarative capability binding at the Supervisor before model invocation. Show every Generator agent connecting to the central Shared Blackboard (not to each other). Use solid arrows for data flow and dashed arrows for observability signals. Ensure the connection logic makes sense: user prompt -> supervisor -> generators read/write blackboard in parallel -> critic + synthesizer read blackboard -> optional debate loop -> retrieval feeds typed citations into blackboard -> blackboard streams to canvas frontend -> observability strip feeds health overlay onto canvas."""

if __name__ == "__main__":
    out = Path(__file__).parent / "fig-arch-starlink.png"
    generate(prompt=PROMPT, output_path=out)
