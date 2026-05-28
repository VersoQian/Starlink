#!/usr/bin/env bash
# Bailian/DashScope, gpt-solo + Starlink, N=12 on a single backend.
# Usage: run-bailian-starlink.sh <model-id>
# Example: run-bailian-starlink.sh MiniMax-M2.5
set -eu

BACKEND="${1:?usage: $0 <model-id>}"
cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${DASHSCOPE_API_KEY:?DASHSCOPE_API_KEY must be set in .env}"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set in .env}"

SAFE=$(echo "$BACKEND" | tr '/.' '__')
LOG_DIR="benchmark/bailian-starlink-${SAFE}-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

echo "===== BAILIAN STARLINK RUN $(date) ====="
echo "log dir: $LOG_DIR"
echo "backend: $BACKEND (Bailian/DashScope)"
echo "judge:   deepseek-chat @ api.deepseek.com (direct)"
echo "runners: gpt-solo, starlink"
echo ""

LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
LLM_API_KEY="$DASHSCOPE_API_KEY" \
LLM_MODEL_OVERRIDE="$BACKEND" \
LLM_MODEL="$BACKEND" \
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
JUDGE_MODEL="deepseek-chat" \
JUDGE_ENSEMBLE_SIZE=1 \
node dist/benchmark/eval/yc-vs-runners.js \
  --runners=gpt-solo,starlink \
  > "$LOG_DIR/run.log" 2>&1

echo "===== DONE $(date) ====="
ls -lt benchmark/reports/yc-vs-runners-*.md | head -3
