#!/usr/bin/env bash
# DeepSeek-V3.2 backend, gpt-solo + Starlink runners (N=12, no forced).
# Quality (D1) + Coverage (D2) + per-agent handoff trace for D3/D4 metrics.
#
# Judge:    deepseek-v4-flash @ api.deepseek.com (single, no ensemble)
# Backend:  deepseek-ai/DeepSeek-V3.2 (SiliconFlow, voucher)
# Runners:  gpt-solo + starlink (skip forced — path B2)
# Cases:    n=12
set -eu

cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${SILICONFLOW_API_KEY:?SILICONFLOW_API_KEY must be set in .env}"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set in .env}"

LOG_DIR="benchmark/deepseek-starlink-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"
echo "$LOG_DIR" > /tmp/deepseek-starlink-logdir.txt

echo "===== DEEPSEEK gpt-solo + Starlink RUN $(date) ====="
echo "log dir: $LOG_DIR"
echo "backend: deepseek-ai/DeepSeek-V3.2 (SiliconFlow)"
echo "judge:   deepseek-v4-flash @ api.deepseek.com"
echo "runners: gpt-solo, starlink"
echo ""

LLM_BASE_URL=https://api.siliconflow.cn/v1 \
LLM_API_KEY="$SILICONFLOW_API_KEY" \
LLM_MODEL_OVERRIDE="deepseek-ai/DeepSeek-V3.2" \
LLM_MODEL="deepseek-ai/DeepSeek-V3.2" \
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
JUDGE_MODEL="deepseek-v4-flash" \
JUDGE_ENSEMBLE_SIZE=1 \
node dist/benchmark/eval/yc-vs-runners.js \
  --runners=gpt-solo,starlink \
  > "$LOG_DIR/deepseek-v3.2.log" 2>&1

echo "===== DONE $(date) ====="
ls -lt benchmark/reports/yc-vs-runners-*.md | head -3
