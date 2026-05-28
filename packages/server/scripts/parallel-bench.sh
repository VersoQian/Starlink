#!/usr/bin/env bash
# Reusable parallel benchmark runner.
# Splits the 12 YC cases into K halves, runs each in a separate background
# process, waits for all halves, then aggregates the per-half reports into
# a single consolidated report via aggregate-halves.py.
#
# Usage:
#   parallel-bench.sh <backend-model> [<provider>] [<num-halves>] [<runners>]
#
# Examples:
#   parallel-bench.sh deepseek-chat deepseek 2 gpt-solo,starlink
#   parallel-bench.sh MiniMax-M2.5 dashscope 2 gpt-solo,starlink
#   parallel-bench.sh glm-4.6 dashscope 3 gpt-solo,starlink
#   parallel-bench.sh deepseek-ai/DeepSeek-V3.2 siliconflow 4 gpt-solo
#
# Providers map to (base_url, api_key_env_var):
#   deepseek    -> https://api.deepseek.com/v1           , DEEPSEEK_API_KEY
#   dashscope   -> https://dashscope.aliyuncs.com/...    , DASHSCOPE_API_KEY
#   siliconflow -> https://api.siliconflow.cn/v1         , SILICONFLOW_API_KEY
#
# Judge is always deepseek-chat @ api.deepseek.com (paper-matching). To
# override, export JUDGE_MODEL / DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY before
# invoking.
set -eu

BACKEND="${1:?usage: $0 <backend-model> [provider] [num-halves] [runners]}"
PROVIDER="${2:-dashscope}"
N_HALVES="${3:-2}"
RUNNERS="${4:-gpt-solo,starlink}"

cd "$(dirname "$0")/.."
set -a; source .env; set +a

# Provider routing
case "$PROVIDER" in
  deepseek)
    SYS_BASE_URL="https://api.deepseek.com/v1"
    SYS_KEY="${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY required}"
    ;;
  dashscope|bailian)
    SYS_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
    SYS_KEY="${DASHSCOPE_API_KEY:?DASHSCOPE_API_KEY required}"
    ;;
  siliconflow)
    SYS_BASE_URL="https://api.siliconflow.cn/v1"
    SYS_KEY="${SILICONFLOW_API_KEY:?SILICONFLOW_API_KEY required}"
    ;;
  *)
    echo "Unknown provider: $PROVIDER (must be deepseek|dashscope|siliconflow)"
    exit 1
    ;;
esac

# Judge config (always DeepSeek-chat direct unless overridden)
JUDGE_BASE_URL="${DEEPSEEK_BASE_URL:-https://api.deepseek.com/v1}"
JUDGE_KEY="${DEEPSEEK_API_KEY:?DEEPSEEK_API_KEY required for judge}"
JUDGE_M="${JUDGE_MODEL:-deepseek-chat}"
ENSEMBLE="${JUDGE_ENSEMBLE_SIZE:-1}"

# Canonical 12-case YC seed set
ALL_CASES=(
  "yc-stripe-2024" "yc-airbnb-2024" "yc-replit-2024"
  "yc-pebble-2016" "extended-coursera-2024" "yc-notion-2024"
  "yc-coinbase-2021" "yc-doordash-2020" "yc-twitch-2014"
  "yc-segment-2020" "yc-brex-2024" "yc-substack-2024"
)
N_CASES=${#ALL_CASES[@]}

# Compute case split
CASES_PER_HALF=$(( (N_CASES + N_HALVES - 1) / N_HALVES ))

# Setup parent log dir
SAFE=$(echo "$BACKEND" | tr '/.' '__')
TS=$(date +%Y%m%d-%H%M%S)
ROOT="benchmark/parallel-${SAFE}-${TS}"
mkdir -p "$ROOT"

echo "════════════════════════════════════════════════════════════"
echo "  PARALLEL BENCH @ $(date)"
echo "    backend:   $BACKEND ($PROVIDER)"
echo "    runners:   $RUNNERS"
echo "    cases:     $N_CASES split into $N_HALVES halves ($CASES_PER_HALF per half)"
echo "    judge:     $JUDGE_M @ $JUDGE_BASE_URL"
echo "    root dir:  $ROOT"
echo "════════════════════════════════════════════════════════════"

# Launch each half in background
HALF_DIRS=()
HALF_PIDS=()
for ((H=0; H<N_HALVES; H++)); do
  START=$(( H * CASES_PER_HALF ))
  END=$(( START + CASES_PER_HALF ))
  [ $END -gt $N_CASES ] && END=$N_CASES
  [ $START -ge $N_CASES ] && break

  HALF_CASES=""
  for ((I=START; I<END; I++)); do
    HALF_CASES="${HALF_CASES}${ALL_CASES[$I]},"
  done
  HALF_CASES="${HALF_CASES%,}"

  HALF_DIR="$ROOT/half-$H"
  mkdir -p "$HALF_DIR"
  HALF_DIRS+=("$HALF_DIR")

  echo ""
  echo "─── half $H: ${HALF_CASES} ───"

  LLM_BASE_URL="$SYS_BASE_URL" \
  LLM_API_KEY="$SYS_KEY" \
  LLM_MODEL_OVERRIDE="$BACKEND" \
  LLM_MODEL="$BACKEND" \
  DEEPSEEK_BASE_URL="$JUDGE_BASE_URL" \
  DEEPSEEK_API_KEY="$JUDGE_KEY" \
  JUDGE_MODEL="$JUDGE_M" \
  JUDGE_ENSEMBLE_SIZE="$ENSEMBLE" \
  nohup node dist/benchmark/eval/yc-vs-runners.js \
    --runners="$RUNNERS" \
    --case="$HALF_CASES" \
    > "$HALF_DIR/run.log" 2>&1 &

  PID=$!
  HALF_PIDS+=("$PID")
  echo "  launched PID $PID → $HALF_DIR/run.log"

  # Small stagger to avoid timestamp collisions in report filenames
  sleep 2
done

echo ""
echo "all $N_HALVES halves launched. waiting for completion..."
echo "PIDs: ${HALF_PIDS[*]}"
echo ""

# Wait for all halves
FAILED=0
for PID in "${HALF_PIDS[@]}"; do
  if wait "$PID"; then
    echo "  PID $PID ✓ done"
  else
    echo "  PID $PID ✗ failed (exit $?)"
    FAILED=$((FAILED+1))
  fi
done

echo ""
echo "$((N_HALVES-FAILED))/$N_HALVES halves succeeded"

# Find per-half reports and aggregate
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  AGGREGATING"
echo "════════════════════════════════════════════════════════════"

PER_HALF_REPORTS=()
for HALF_DIR in "${HALF_DIRS[@]}"; do
  REPORT=$(grep -E "report written" "$HALF_DIR/run.log" 2>/dev/null | tail -1 | sed 's/.*: //')
  if [ -n "$REPORT" ] && [ -f "$REPORT" ]; then
    PER_HALF_REPORTS+=("$REPORT")
    echo "  $HALF_DIR → $REPORT"
  else
    echo "  $HALF_DIR → no report (failed?)"
  fi
done

if [ ${#PER_HALF_REPORTS[@]} -gt 1 ]; then
  AGG_OUT="$ROOT/consolidated.md"
  python3 scripts/aggregate-halves.py \
    --backend "$BACKEND" \
    --output "$AGG_OUT" \
    "${PER_HALF_REPORTS[@]}"
  echo ""
  echo "consolidated report: $AGG_OUT"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  DONE $(date)"
echo "════════════════════════════════════════════════════════════"
