#!/usr/bin/env bash
# Three-backend N=12 baseline matrix:
#   Backends (system under test, via SiliconFlow):
#     - Pro/deepseek-ai/DeepSeek-V3.2
#     - MiniMaxAI/MiniMax-M2.5
#     - Pro/zai-org/GLM-4.7
#   Runners per backend: starlink, gpt-solo, gpt-solo-forced
#   Judge: deepseek-v4-pro (direct DeepSeek API), ensemble size 3
#
# Required env (set in packages/server/.env or shell):
#   SILICONFLOW_API_KEY   — SiliconFlow API key (system under test)
#   DEEPSEEK_API_KEY      — DeepSeek API key (judge), rotated
#
# Run from packages/server/:
#   bash scripts/run-three-backends.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# ─── env validation ─────────────────────────────────────────────────────────
if [[ -z "${SILICONFLOW_API_KEY:-}" ]]; then
  # fall back to .env
  set -a
  # shellcheck disable=SC1091
  [[ -f .env ]] && source .env
  set +a
fi

: "${SILICONFLOW_API_KEY:?SILICONFLOW_API_KEY must be set (in .env or shell)}"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set (in .env or shell, rotated key)}"

# ─── shared config ──────────────────────────────────────────────────────────
export DATABASE_URL="postgres://nobody:nobody@127.0.0.1:5432/nodb"
export LANGGRAPH_CHECKPOINTER_ENABLED=false
export MEMORY_WRITE_ENABLED=false
export MEMORY_READ_ENABLED=false
export ORCHESTRATION_MODE=registry
export HITL_ENABLED=false

# Judge: DeepSeek v4 Pro, ensemble of 3 (temp 0.0/0.3/0.6, median)
export DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
export JUDGE_MODEL="deepseek-v4-pro"
export JUDGE_ENSEMBLE_SIZE=3

# System under test: SiliconFlow
export LLM_BASE_URL="https://api.siliconflow.cn/v1"
export LLM_API_KEY="$SILICONFLOW_API_KEY"

# ─── ensure build is fresh ──────────────────────────────────────────────────
echo "==> [pre] build"
pnpm run build > /dev/null

# ─── run matrix ─────────────────────────────────────────────────────────────
BACKENDS=(
  "Pro/deepseek-ai/DeepSeek-V3.2"
  "MiniMaxAI/MiniMax-M2.5"
  "Pro/zai-org/GLM-4.7"
)

LOG_DIR="benchmark/reports/three-backends-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

echo "==> matrix output dir: $LOG_DIR"
echo "==> judge: $JUDGE_MODEL (ensemble=$JUDGE_ENSEMBLE_SIZE)"
echo ""

for MODEL_ID in "${BACKENDS[@]}"; do
  SAFE_NAME="$(echo "$MODEL_ID" | tr '/' '_')"
  echo "════════════════════════════════════════════════════════════"
  echo "==> backend: $MODEL_ID"
  echo "    log:     $LOG_DIR/$SAFE_NAME.log"
  echo "════════════════════════════════════════════════════════════"

  LLM_MODEL="$MODEL_ID" \
    node --env-file=.env dist/benchmark/eval/yc-vs-runners.js \
      --runners=starlink,gpt-solo,gpt-solo-forced \
      2>&1 | tee "$LOG_DIR/$SAFE_NAME.log"

  echo "==> [done] $MODEL_ID"
  echo ""
done

echo "════════════════════════════════════════════════════════════"
echo "all three backends complete · logs in $LOG_DIR"
echo "fresh reports in benchmark/reports/yc-vs-runners-*.md (one per backend)"
echo "════════════════════════════════════════════════════════════"
