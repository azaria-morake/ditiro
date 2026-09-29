#!/usr/bin/env bash
# Ditiro Drone - Standalone Android Emulator Launcher
# Runs without opening Android Studio to preserve system RAM and CPU

export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$HOME/Android/Sdk"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

AVD_NAME="ditiro_drone"

echo "=========================================="
echo "   Ditiro Drone - Standalone Emulator    "
echo "=========================================="

# Check if an emulator is already online
RUNNING_DEVICE=$(adb devices | grep "emulator-" | awk '{print $1}' | head -n 1)

if [ -n "$RUNNING_DEVICE" ]; then
    echo "✓ Emulator is already running ($RUNNING_DEVICE)."
else
    echo "Launching Android Virtual Device: $AVD_NAME..."
    echo "Hardware acceleration (KVM) enabled. Running in background..."
    emulator -avd "$AVD_NAME" -netdelay none -netspeed full &
    
    echo "Waiting for emulator to boot up..."
    adb wait-for-device
    echo "✓ Emulator online and ready!"
fi

echo ""
echo "Helpful Commands:"
echo "  • Install APK:       adb install /path/to/app.apk"
echo "  • Run Expo Dev:      cd ditiro-drone && npm run android"
echo "  • View device logs:  adb logcat -s ReactNativeJS"
echo "=========================================="
