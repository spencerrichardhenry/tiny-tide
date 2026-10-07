#!/bin/sh
# Builds Tiny Tide into the Android app (landscape, full screen) and installs it on the connected phone.
# Run with: npm run android:install. Your saves on the phone stay.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
export ANDROID_HOME="${ANDROID_HOME:-$ROOT/../.android-sdk}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
ADB="$ANDROID_HOME/platform-tools/adb"
cd "$ROOT"
npx vite build --base=./ --outDir dist-android --emptyOutDir --logLevel warn
npx cap sync android > /dev/null
(cd android && ./gradlew -q assembleDebug)
"$ADB" install -r android/app/build/outputs/apk/debug/app-debug.apk
"$ADB" shell am start -n com.spencerhenry.tinytide/.MainActivity > /dev/null
echo "Tiny Tide is installed and open on the phone."
