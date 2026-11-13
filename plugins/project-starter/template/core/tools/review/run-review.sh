#!/bin/bash
# Independent read-only review batches. The reviewer only reads; Claude triages the result.
#
#   tools/review/run-review.sh 12 13            run batches 12 and 13, one after the other
#   tools/review/run-review.sh --at 05:40 12    wait until 05:40 (a usage-limit reset), then run
#
# Batch N needs its scope in docs/reviews/batches/N.txt. The output is docs/reviews/batch-N.md,
# kept as the reviewer wrote it. The reviewer comes from .project/config.json (reviewer.tool):
# codex (default) or opencode. With "agents" the review runs inside Claude (/review), not here.
# Stops at the first failure (for example a usage limit) and says where.
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO/docs/reviews"
LOG="$REPO/tools/review/logs"
mkdir -p "$LOG"

cfg() { node -e "const c=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const v=process.argv[2].split('.').reduce((o,k)=>o&&o[k],c);process.stdout.write(v==null?'':String(v))" "$REPO/.project/config.json" "$1" 2>/dev/null; }
TOOL="$(cfg reviewer.tool)"; TOOL="${TOOL:-codex}"
MODEL="$(cfg reviewer.model)"

if [ "$TOOL" != "codex" ] && [ "$TOOL" != "opencode" ]; then
  echo "reviewer.tool is '$TOOL': this script runs codex or opencode only. Use /review in Claude."
  exit 1
fi

# Keep Windows out of standby while the batches (or a wait) run.
if command -v powershell.exe > /dev/null 2>&1 && [ -f "$REPO/tools/review/keep-awake.ps1" ]; then
  AWAKE="$LOG/awake.lock"
  : > "$AWAKE"
  trap 'rm -f "$AWAKE"' EXIT
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$REPO/tools/review/keep-awake.ps1")" -LockFile "$(cygpath -w "$AWAKE")" > /dev/null 2>&1 &
fi

if [ "$1" = "--at" ]; then
  # Poll the wall clock: a single long sleep does not count the time the machine was asleep.
  AT="$(date -d "today $2" +%s)" || exit 1
  [ "$AT" -le "$(date +%s)" ] && AT=$((AT + 86400))
  echo "[$(date +%T)] waiting until $(date -d "@$AT" +%T)"
  until [ "$(date +%s)" -ge "$AT" ]; do sleep 60; done
  shift 2
fi

[ $# -eq 0 ] && { echo "Usage: tools/review/run-review.sh [--at HH:MM] <batch number>..."; exit 1; }

for N in "$@"; do
  REPORT="$OUT/batch-$N.md"
  # A report is the reviewer's raw output and is never replaced: a new review takes a new number.
  if [ -e "$REPORT" ]; then
    echo "docs/reviews/batch-$N.md already exists: give the new review the next free number."
    exit 1
  fi
  # The lock claims the number so two runs cannot write the same batch.
  if ! mkdir "$LOG/batch-$N.lock" 2> /dev/null; then
    echo "Batch $N is already running (tools/review/logs/batch-$N.lock)."
    exit 1
  fi
  PROMPT="$LOG/prompt-$N.md"
  ATTEMPT="$LOG/batch-$N.attempt.md"
  rm -f "$ATTEMPT"
  node "$REPO/tools/review/prompt.mjs" "$N" > "$PROMPT" || { rmdir "$LOG/batch-$N.lock"; exit 1; }
  BEFORE="$(git -C "$REPO" status --porcelain 2> /dev/null)"
  echo "[$(date +%T)] batch $N start ($TOOL)"
  if [ "$TOOL" = "codex" ]; then
    codex exec -s read-only -C "$REPO" --color never -o "$ATTEMPT" - < "$PROMPT" > "$LOG/batch-$N.log" 2>&1
  else
    # opencode: one batch at a time (parallel runs lock its database); stdin closed or it waits forever.
    # Its "plan" agent is read-only only as far as the user's opencode permissions say (see README).
    opencode run "Follow the instructions in the attached prompt file exactly. Output only the review report." \
      --agent plan ${MODEL:+-m "$MODEL"} --dir "$REPO" -f "$PROMPT" < /dev/null > "$ATTEMPT" 2> "$LOG/batch-$N.log"
  fi
  RC=$?
  rmdir "$LOG/batch-$N.lock"
  AFTER="$(git -C "$REPO" status --porcelain 2> /dev/null)"
  echo "[$(date +%T)] batch $N exit $RC (log: tools/review/logs/batch-$N.log)"
  if [ "$BEFORE" != "$AFTER" ]; then
    echo "WARNING: the working tree changed while batch $N ran. A reviewer must only read: check git status before trusting it."
  fi
  if [ $RC -ne 0 ] || [ ! -s "$ATTEMPT" ]; then
    echo "Stopped at batch $N (usage limit or error). Partial output, if any: tools/review/logs/batch-$N.attempt.md"
    [ $RC -ne 0 ] && exit $RC
    exit 1
  fi
  mv "$ATTEMPT" "$REPORT"
done
echo "All requested batches done. Triage them in docs/reviews/triage.md."
