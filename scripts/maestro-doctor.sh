#!/usr/bin/env bash
# maestro-doctor.sh — Verify Maestro + native toolchain prerequisites
set -uo pipefail

echo "=== Maestro Doctor ==="
echo ""

# Maestro version
echo "--- Maestro ---"
if command -v maestro &>/dev/null; then
  maestro --version
else
  echo "maestro: NOT FOUND (install: brew install mobile-dev-inc/tap/maestro)"
fi
echo ""

# ADB + Android devices
echo "--- Android (adb) ---"
if command -v adb &>/dev/null; then
  adb version | head -1
  echo "Connected devices:"
  adb devices
else
  echo "adb: NOT FOUND (install Android SDK platform-tools)"
fi
echo ""

# iOS Simulator
echo "--- iOS Simulator (xcrun simctl) ---"
if command -v xcrun &>/dev/null; then
  xcrun simctl list devices booted 2>/dev/null | head -15
else
  echo "xcrun: NOT FOUND (install Xcode from App Store)"
fi
echo ""

echo "=== Doctor complete ==="
