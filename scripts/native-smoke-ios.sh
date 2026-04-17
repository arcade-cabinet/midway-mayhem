#!/usr/bin/env bash
# native-smoke-ios.sh — Full iOS Maestro smoke suite.
# Preconditions:
#   - Xcode installed, xcrun simctl available
#   - iOS Simulator booted: xcrun simctl list devices booted
#   - App .app bundle built and installed:
#       xcrun simctl install booted <path/to/App.app>
#   - Maestro CLI installed: brew install mobile-dev-inc/tap/maestro
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCREENSHOT_DIR="${PROJECT_DIR}/docs/media/maestro/ios"

echo "[smoke:ios] Project: ${PROJECT_DIR}"

# ── 1. Verify xcrun simctl ────────────────────────────────────────────────────
if ! command -v xcrun &>/dev/null; then
  echo "[smoke:ios] ERROR: xcrun not found — Xcode Command Line Tools required."
  echo "  Install: xcode-select --install"
  exit 1
fi

# ── 2. Verify booted simulator ───────────────────────────────────────────────
BOOTED=$(xcrun simctl list devices booted 2>/dev/null)
if ! echo "${BOOTED}" | grep -q "Booted"; then
  echo "[smoke:ios] ERROR: No booted iOS Simulator found."
  echo "  List available: xcrun simctl list devices available"
  echo "  Boot one:        xcrun simctl boot <device-udid>"
  exit 1
fi
echo "[smoke:ios] Booted simulator found."

# ── 3. Verify Maestro CLI ─────────────────────────────────────────────────────
if ! command -v maestro &>/dev/null; then
  echo "[smoke:ios] ERROR: maestro CLI not found in PATH."
  echo "  Install: brew install mobile-dev-inc/tap/maestro"
  exit 1
fi

# ── 4. Build native bundle + sync ─────────────────────────────────────────────
echo "[smoke:ios] Building native bundle..."
cd "${PROJECT_DIR}"
pnpm build:native

echo "[smoke:ios] Syncing Capacitor..."
pnpm exec cap sync ios

# ── 5. Build .app for the booted simulator ────────────────────────────────────
echo "[smoke:ios] Building iOS simulator .app via xcodebuild..."
xcodebuild \
  -workspace "${PROJECT_DIR}/ios/App/App.xcworkspace" \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  -derivedDataPath "${PROJECT_DIR}/ios/DerivedData" \
  build 2>&1 | tail -20

APP_PATH=$(find "${PROJECT_DIR}/ios/DerivedData" -name "App.app" -maxdepth 6 | head -1)
if [ -z "${APP_PATH}" ]; then
  echo "[smoke:ios] ERROR: App.app not found after xcodebuild."
  exit 1
fi

echo "[smoke:ios] Installing ${APP_PATH} on booted simulator..."
xcrun simctl install booted "${APP_PATH}"

# ── 6. Ensure screenshot dir exists ──────────────────────────────────────────
mkdir -p "${SCREENSHOT_DIR}"

# ── 7. Run Maestro flows sequentially ────────────────────────────────────────
FLOWS=(
  "ios-smoke.yaml"
  "ios-gameplay-30s.yaml"
  "ios-critter-scare.yaml"
  "ios-ramp-trick.yaml"
  "ios-pause-resume.yaml"
  "ios-game-over.yaml"
)

FAILED=()

for FLOW in "${FLOWS[@]}"; do
  FLOW_PATH="${PROJECT_DIR}/maestro/${FLOW}"
  echo ""
  echo "[smoke:ios] ── Running flow: ${FLOW} ──"
  if maestro test "${FLOW_PATH}"; then
    echo "[smoke:ios] PASSED: ${FLOW}"
  else
    echo "[smoke:ios] FAILED: ${FLOW}"
    FAILED+=("${FLOW}")
  fi
done

# ── 8. Copy screenshots ───────────────────────────────────────────────────────
LATEST_MAESTRO_RUN=$(ls -1dt "${HOME}/.maestro/tests/"* 2>/dev/null | head -1)
if [ -n "${LATEST_MAESTRO_RUN}" ]; then
  echo "[smoke:ios] Copying screenshots from ${LATEST_MAESTRO_RUN}"
  find "${LATEST_MAESTRO_RUN}" -name "*.png" -exec cp {} "${SCREENSHOT_DIR}/" \;
  echo "[smoke:ios] Screenshots in ${SCREENSHOT_DIR}/"
fi

# ── 9. Assert 100 m screenshot exists ────────────────────────────────────────
MID_RUN_SS="${SCREENSHOT_DIR}/mid-run.png"
if [ ! -f "${MID_RUN_SS}" ]; then
  echo "[smoke:ios] ERROR: mid-run screenshot not found — 100 m distance was not reached."
  FAILED+=("ios-gameplay-30s.yaml (100m assertion)")
fi

# ── 10. Report ────────────────────────────────────────────────────────────────
echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "[smoke:ios] ALL FLOWS PASSED."
  exit 0
else
  echo "[smoke:ios] FAILED FLOWS:"
  for F in "${FAILED[@]}"; do
    echo "  - ${F}"
  done
  exit 1
fi
