#!/usr/bin/env bash
# Sequential 3-backend run (RPM-safe given SiliconFlow ~40 RPM cap).
# Total wall: ~75-90 min. Cost: voucher-covered (¥0).
set -eu

cd /Users/sheng/git/video/Starlink/packages/server
set -a; source .env; set +a

: "${SILICONFLOW_API_KEY:?SILICONFLOW_API_KEY must be set}"

LOG_DIR="benchmark/three-backends-seq-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"
echo "$LOG_DIR" > /tmp/three-backends-logdir.txt

echo "===== SEQUENTIAL 3-BACKEND RUN START $(date) ====="
echo "log dir: $LOG_DIR"
echo "judge:   moonshotai/Kimi-K2-Thinking (single, no ensemble)"
echo ""

for backend in \
  "deepseek-ai/DeepSeek-V3.2" \
  "zai-org/GLM-4.6" \
  "Qwen/Qwen2.5-14B-Instruct"
do
  safe=$(echo "$backend" | tr '/' '_')
  echo "----- START $backend at $(date) -----"

  LLM_BASE_URL=https://api.siliconflow.cn/v1 \
  LLM_API_KEY="$SILICONFLOW_API_KEY" \
  LLM_MODEL_OVERRIDE="$backend" \
  LLM_MODEL="$backend" \
  DEEPSEEK_BASE_URL=https://api.siliconflow.cn/v1 \
  DEEPSEEK_API_KEY="$SILICONFLOW_API_KEY" \
  JUDGE_MODEL="moonshotai/Kimi-K2-Thinking" \
  JUDGE_ENSEMBLE_SIZE=1 \
  node dist/benchmark/eval/yc-vs-runners.js \
    --runners=starlink,gpt-solo,gpt-solo-forced \
    > "$LOG_DIR/$safe.log" 2>&1

  echo "----- DONE  $backend at $(date) -----"
done

echo ""
echo "===== ALL THREE BACKENDS COMPLETE $(date) ====="
echo "reports: ls -lt benchmark/reports/ | head -5"
ls -lt benchmark/reports/yc-vs-runners-*.md | head -5
