#!/usr/bin/env bash
# DeepSeek DIRECT API (api.deepseek.com), gpt-solo + Starlink, N=12.
# Bypasses SiliconFlow RPM cap. Matches paper's "primary backend".
set -eu

cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set in .env}"

LOG_DIR="benchmark/deepseek-direct-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"
echo "$LOG_DIR" > /tmp/deepseek-direct-logdir.txt

echo "===== DEEPSEEK DIRECT RUN $(date) ====="
echo "log dir: $LOG_DIR"
echo "backend: deepseek-chat @ api.deepseek.com (direct)"
echo "judge:   deepseek-chat @ api.deepseek.com (same family — paper-matching)"
echo "runners: gpt-solo, starlink"
echo ""

LLM_BASE_URL=https://api.deepseek.com/v1 \
LLM_API_KEY="$DEEPSEEK_API_KEY" \
LLM_MODEL_OVERRIDE="deepseek-chat" \
LLM_MODEL="deepseek-chat" \
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \
DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
JUDGE_MODEL="deepseek-chat" \
JUDGE_ENSEMBLE_SIZE=1 \
node dist/benchmark/eval/yc-vs-runners.js \
  --runners=gpt-solo,starlink \
  > "$LOG_DIR/deepseek-chat.log" 2>&1

echo "===== DONE $(date) ====="
ls -lt benchmark/reports/yc-vs-runners-*.md | head -3
