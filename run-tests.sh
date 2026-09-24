#!/usr/bin/env bash
#
# OYA — full test suite.
#
#   ./run-tests.sh            run everything
#   ./run-tests.sh backend    Django tests only
#   ./run-tests.sh frontend   JS tests only
#
# Exits non-zero if any suite fails, so it can be dropped straight into CI.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${PYTHON:-$ROOT/../.venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON="$(command -v python3)"

TARGET="${1:-all}"
FAILED=0

bar() { printf '\n\033[1m%s\033[0m\n' "$1"; }

run_backend() {
  bar "Backend — Django test suite"
  cd "$ROOT/backend" || return 1
  # settings_test: in-memory SQLite, fast hasher, no network, no B2
  # credentials, logging silenced.
  "$PYTHON" manage.py test tests --settings=oya.settings_test || return 1
}

run_frontend() {
  bar "Frontend — JS test suite"
  cd "$ROOT" || return 1
  command -v node >/dev/null 2>&1 || { echo "node not found — skipping"; return 0; }
  node tests/frontend/run-all.mjs || return 1
}

run_syntax() {
  bar "Syntax check — every shipped JS file parses"
  cd "$ROOT/frontend" || return 1
  local bad=0
  for f in assets/js/*.js assets/js/*/*.js sw.js; do
    [ -e "$f" ] || continue
    node --check "$f" 2>/dev/null || { echo "  ✗ $f"; bad=1; }
  done
  [ "$bad" -eq 0 ] && echo "  all files parse cleanly"
  return $bad
}

case "$TARGET" in
  backend)  run_backend  || FAILED=1 ;;
  frontend) run_syntax || FAILED=1; run_frontend || FAILED=1 ;;
  all)
    run_backend  || FAILED=1
    run_syntax   || FAILED=1
    run_frontend || FAILED=1
    ;;
  *) echo "usage: $0 [all|backend|frontend]"; exit 2 ;;
esac

if [ "$FAILED" -eq 0 ]; then
  printf '\n\033[32m✓ all suites passed\033[0m\n'
else
  printf '\n\033[31m✗ one or more suites failed\033[0m\n'
fi
exit "$FAILED"
