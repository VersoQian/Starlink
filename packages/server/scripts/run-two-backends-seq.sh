#!/usr/bin/env bash
# Sequential 2-backend run: MiniMax + Qwen
# Judge: deepseek-v4-flash via api.deepseek.com (fast, ~3s/call)
# Systems: SiliconFlow (MiniMax = paid, Qwen = voucher)
# Total wall: ~60-90 min. Voucher covers Qwen; MiniMax ~¥3-5.
set -eu

cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${SILICONFLOW_API_KEY:?SILICONFLOW_API_KEY must be set}"
: "${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY must be set}"

LOG_DIR="benchmark/two-backends-seq-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"
echo "$LOG_DIR" > /tmp/two-backends-logdir.txt

echo "===== SEQUENTIAL 2-BACKEND RUN START $(date) ====="
echo "log dir: $LOG_DIR"
echo "judge:   deepseek-v4-flash @ api.deepseek.com (single, no ensemble)"
echo "systems: SiliconFlow"
echo ""

for backend in \
  "MiniMaxAI/MiniMax-M2.5" \
  "Qwen/Qwen2.5-14B-Instruct"
do
  safe=$(echo "$backend" | tr '/' '_')
  echo "----- START $backend at $(date) -----"

  LLM_BASE_URL=https://api.siliconflow.cn/v1 \
  LLM_API_KEY="$SILICONFLOW_API_KEY" \
  LLM_MODEL_OVERRIDE="$backend" \
  LLM_MODEL="$backend" \
  DEEPSEEK_BASE_URL=https://api.deepseek.com/v1 \
  DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  JUDGE_MODEL="deepseek-v4-flash" \
  JUDGE_ENSEMBLE_SIZE=1 \
  node dist/benchmark/eval/yc-vs-runners.js \
    --runners=starlink,gpt-solo,gpt-solo-forced \
    > "$LOG_DIR/$safe.log" 2>&1

  echo "----- DONE  $backend at $(date) -----"
done

echo ""
echo "===== ALL DONE $(date) ====="
echo "reports:"
ls -lt benchmark/reports/yc-vs-runners-*.md | head -3
