#!/usr/bin/env bash
# Runs the complete test suite:
#   1. backend REST + PTY terminal tests against the live server
#   2. UI boot tests (jsdom)
#   3. full agent loop against a mock Inception API
#   4. approval gating in "ask" mode
set -u
cd "$(dirname "$0")/.."

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null; done
  rm -f sandbox-summary.md
}
trap cleanup EXIT

fail=0
step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

# ── 1. Real server on :3000 (against the real Inception endpoint; no calls made)
step "Starting app on :3000"
node server/index.js > /tmp/arena-test-3000.log 2>&1 &
pids+=($!)
for _ in $(seq 1 40); do
  curl -sf -m1 localhost:3000/api/health > /dev/null && break
  sleep 0.25
done

step "Backend + terminal tests"
node test/smoke.js || fail=1

step "UI boot tests"
node test/ui.js || fail=1

# ── 2. Mock Inception API + second app instance
step "Starting mock Inception API on :4010"
node test/mock-inception.js 4010 > /tmp/arena-test-mock.log 2>&1 &
pids+=($!)
step "Starting app on :3001 pointed at the mock"
INCEPTION_BASE_URL=http://127.0.0.1:4010/v1 PORT=3001 node server/index.js > /tmp/arena-test-3001.log 2>&1 &
pids+=($!)
for _ in $(seq 1 40); do
  curl -sf -m1 localhost:3001/api/health > /dev/null && break
  sleep 0.25
done

step "Agent loop end-to-end"
node test/agent-e2e.js || fail=1

step "Approval gate"
node test/approval.js || fail=1

if [ "$fail" -eq 0 ]; then
  printf '\n\033[32m✓ all suites passed\033[0m\n\n'
else
  printf '\n\033[31m✗ some suites failed\033[0m\n\n'
fi
exit "$fail"
