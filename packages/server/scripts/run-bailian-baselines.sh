#!/usr/bin/env bash
# Cross-vendor BASELINE comparison: gpt-solo vs gpt-solo-forced on Bailian/DashScope.
# Skips starlink runner (strict tool calling incompatible with these models via Bailian).
#
# Judge:    deepseek-v4-flash @ api.deepseek.com (fast, ~3s/call)
# Backends: MiniMax-M2.5, qwen2.5-14b-instruct (both Bailian/DashScope)
# Runners:  gpt-solo + gpt-solo-forced
# Cases:    n=12 each backend
#
# Expected wall: ~10-15 min total.
set -eu

cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${DASHSCOPE_API_KEY:?DASHSCOPE_API_KEY must be set in .env}"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set in .env}"

LOG_DIR="benchmark/bailian-baselines-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"
echo "$LOG_DIR" > /tmp/bailian-logdir.txt

echo "===== BAILIAN BASELINE RUN START $(date) ====="
echo "log dir: $LOG_DIR"
echo "judge:   deepseek-v4-flash @ api.deepseek.com"
echo "systems: Bailian/DashScope (compatible-mode)"
echo ""

for backend in \
  "MiniMax-M2.5" \
  "qwen2.5-14b-instruct"
do
  safe=$(echo "$backend" | tr '/.' '__')
  echo "----- START $backend at $(date) -----"

  LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 \
  LLM_API_KEY="$DASHSCOPE_API_KEY" \
  LLM_MODEL_OVERRIDE="$backend" \
  LLM_MODEL="$backend" \
  DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \
  DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  JUDGE_MODEL="deepseek-v4-flash" \
  JUDGE_ENSEMBLE_SIZE=1 \
  node dist/benchmark/eval/yc-vs-runners.js \
    --runners=gpt-solo,gpt-solo-forced \
    > "$LOG_DIR/$safe.log" 2>&1

  echo "----- DONE  $backend at $(date) -----"
done

echo ""
echo "===== ALL DONE $(date) ====="
echo "reports:"
ls -lt benchmark/reports/yc-vs-runners-*.md | head -3
