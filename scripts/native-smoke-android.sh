#!/usr/bin/env bash
# native-smoke-android.sh — Full Android Maestro smoke suite.
# Preconditions:
#   - android/ directory exists (pnpm exec cap add android already run)
#   - adb in PATH, emulator running or device connected (adb devices)
#   - Maestro CLI installed: brew install mobile-dev-inc/tap/maestro
#   - Java 21 in PATH (JAVA_HOME set, or available via sdk manager)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCREENSHOT_DIR="${PROJECT_DIR}/docs/media/maestro/android"
APK_PATH="${PROJECT_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"

echo "[smoke:android] Project: ${PROJECT_DIR}"

# ── 1. Verify android/ exists ─────────────────────────────────────────────────
if [ ! -d "${PROJECT_DIR}/android" ]; then
  echo "[smoke:android] ERROR: android/ directory missing."
  echo "  Run: pnpm exec cap add android"
  exit 1
fi

# ── 2. Verify adb device ──────────────────────────────────────────────────────
if ! command -v adb &>/dev/null; then
  echo "[smoke:android] ERROR: adb not found in PATH."
  echo "  Install Android platform-tools or set ANDROID_HOME."
  exit 1
fi

if ! adb devices | grep -q "device$"; then
  echo "[smoke:android] ERROR: No Android device/emulator connected."
  echo "  Start an emulator: emulator -avd <avd_name>   or connect a device."
  exit 1
fi
echo "[smoke:android] Device connected."

# ── 3. Verify Maestro CLI ─────────────────────────────────────────────────────
if ! command -v maestro &>/dev/null; then
  echo "[smoke:android] ERROR: maestro CLI not found in PATH."
  echo "  Install: brew install mobile-dev-inc/tap/maestro"
  exit 1
fi

# ── 4. Build + install APK ────────────────────────────────────────────────────
echo "[smoke:android] Building native bundle..."
cd "${PROJECT_DIR}"
pnpm build:native

echo "[smoke:android] Syncing Capacitor..."
pnpm exec cap sync android

echo "[smoke:android] Assembling debug APK..."
cd "${PROJECT_DIR}/android"
./gradlew assembleDebug

echo "[smoke:android] Installing APK on device..."
adb install -r "${APK_PATH}"

# ── 5. Ensure screenshot dir exists ──────────────────────────────────────────
mkdir -p "${SCREENSHOT_DIR}"

# ── 6. Run Maestro flows sequentially ────────────────────────────────────────
FLOWS=(
  "android-smoke.yaml"
  "android-gameplay-30s.yaml"
  "android-critter-scare.yaml"
  "android-ramp-trick.yaml"
  "android-pause-resume.yaml"
  "android-game-over.yaml"
)

FAILED=()

for FLOW in "${FLOWS[@]}"; do
  FLOW_PATH="${PROJECT_DIR}/maestro/${FLOW}"
  echo ""
  echo "[smoke:android] ── Running flow: ${FLOW} ──"
  if maestro test "${FLOW_PATH}"; then
    echo "[smoke:android] PASSED: ${FLOW}"
  else
    echo "[smoke:android] FAILED: ${FLOW}"
    FAILED+=("${FLOW}")
  fi
done

# ── 7. Copy screenshots ───────────────────────────────────────────────────────
# Maestro writes screenshots to ~/.maestro/tests/<timestamp>/*.png
# Copy the most recent test run's PNGs into docs/media/maestro/android/
LATEST_MAESTRO_RUN=$(ls -1dt "${HOME}/.maestro/tests/"* 2>/dev/null | head -1)
if [ -n "${LATEST_MAESTRO_RUN}" ]; then
  echo "[smoke:android] Copying screenshots from ${LATEST_MAESTRO_RUN}"
  find "${LATEST_MAESTRO_RUN}" -name "*.png" -exec cp {} "${SCREENSHOT_DIR}/" \;
  echo "[smoke:android] Screenshots in ${SCREENSHOT_DIR}/"
fi

# ── 8. Assert 100 m in gameplay flow ─────────────────────────────────────────
# Check that mid-run.png exists (Maestro only writes the screenshot on success;
# absence means extendedWaitUntil for "1[0-9][0-9]" failed).
MID_RUN_SS="${SCREENSHOT_DIR}/mid-run.png"
if [ ! -f "${MID_RUN_SS}" ]; then
  echo "[smoke:android] ERROR: mid-run screenshot not found — 100 m distance was not reached."
  FAILED+=("android-gameplay-30s.yaml (100m assertion)")
fi

# ── 9. Report ─────────────────────────────────────────────────────────────────
echo ""
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "[smoke:android] ALL FLOWS PASSED."
  exit 0
else
  echo "[smoke:android] FAILED FLOWS:"
  for F in "${FAILED[@]}"; do
    echo "  - ${F}"
  done
  exit 1
fi
