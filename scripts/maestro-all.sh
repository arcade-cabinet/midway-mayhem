#!/usr/bin/env bash
# Runs every Maestro flow against the currently-installed APK on the
# connected emulator. Exits with the count of failed flows so CI can
# treat "all flows ran but 1 failed" differently from "runner crashed".
#
# Flows that don't exist on disk are SKIPped (not failed) so the
# workflow can reference the full set even while some flows are
# still being authored.

set -u
MAESTRO="$HOME/.maestro/bin/maestro"
FAILED=0
FLOWS=(
  # Launch + app-alive
  "maestro/android-smoke.yaml"
  # Game loop
  "maestro/android-gameplay-30s.yaml"
  "maestro/android-hud-visible.yaml"
  "maestro/android-touch-steering.yaml"
  # UI surfaces
  "maestro/android-title-panels.yaml"
  # Gameplay mechanics
  "maestro/android-critter-scare.yaml"
  "maestro/android-ramp-trick.yaml"
  "maestro/android-pause-resume.yaml"
  "maestro/android-game-over.yaml"
)

mkdir -p docs/media/maestro

for FLOW in "${FLOWS[@]}"; do
  if [ ! -f "$FLOW" ]; then
    echo "SKIP: $FLOW (file not found)"
    continue
  fi
  echo "==> Running $FLOW"
  if "$MAESTRO" test "$FLOW"; then
    echo "PASSED: $FLOW"
  else
    echo "FAILED: $FLOW"
    FAILED=$((FAILED + 1))
  fi
done

echo "Total failed: $FAILED"
exit "$FAILED"
