#!/usr/bin/env bash
# Ditiro Drone - Standalone Android Emulator Launcher
# Optimized for Intel HD Graphics & low-memory environments (720x1280, GPU host, no frame, animations disabled)

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

AVD_NAME="ditiro_drone"

echo "=========================================="
echo "   Ditiro Drone - Standalone Emulator    "
echo "   (Optimized 720p HD + Intel GPU Host)   "
echo "=========================================="

# Check if an emulator is already online
RUNNING_DEVICE=$(adb devices | grep "emulator-" | awk '{print $1}' | head -n 1)

if [ -n "$RUNNING_DEVICE" ]; then
    echo "✓ Emulator is already running ($RUNNING_DEVICE)."
else
    echo "Launching Android Virtual Device: $AVD_NAME..."
    echo "Hardware acceleration: KVM active, GPU mode: host, Resolution: 720x1280."
    
    emulator -avd "$AVD_NAME" -gpu host -no-audio -no-snapshot-load -no-boot-anim -netdelay none -netspeed full &
    
    echo "Waiting for emulator to boot up..."
    adb wait-for-device
    
    # Wait until boot is completed
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
        sleep 2
    done
    
    echo "Applying Intel HD performance tweaks (disabling OS window animations)..."
    adb shell settings put global window_animation_scale 0 >/dev/null 2>&1
    adb shell settings put global transition_animation_scale 0 >/dev/null 2>&1
    adb shell settings put global animator_duration_scale 0 >/dev/null 2>&1
    
    echo "✓ Emulator is ready and optimized!"
fi

echo ""
echo "Helpful Commands:"
echo "  • Install APK:       cd ditiro-drone && npm run install:apk"
echo "  • Run Expo Dev:      cd ditiro-drone && npm run android"
echo "  • Stop Emulator:     adb emu kill"
echo "=========================================="
