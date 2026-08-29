#!/bin/sh
set -eu

cd "$(dirname "$0")"

if [ -z "${JAVA_HOME:-}" ]; then
  if command -v brew >/dev/null 2>&1 && brew --prefix openjdk@17 >/dev/null 2>&1; then
    JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
    export JAVA_HOME
  else
    echo "需要 JDK 17；请设置 JAVA_HOME 后重试。" >&2
    exit 1
  fi
fi

if [ -z "${ANDROID_HOME:-}" ] && [ -d "$HOME/Library/Android/sdk" ]; then
  ANDROID_HOME="$HOME/Library/Android/sdk"
  export ANDROID_HOME
fi

if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "未找到 Android SDK；请设置 ANDROID_HOME 后重试。" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "未找到 adb；请先安装 Android platform-tools。" >&2
  exit 1
fi

if ! adb get-state >/dev/null 2>&1; then
  echo "未检测到已授权的 Android 手机。" >&2
  exit 1
fi

set -- ./gradlew --no-daemon :app:assembleDebug
if [ -n "${RALLY_API_ORIGIN:-}" ]; then
  set -- "$@" "-PrallyApiOrigin=${RALLY_API_ORIGIN}"
fi
if [ -n "${RALLY_APP_ORIGIN:-}" ]; then
  set -- "$@" "-PrallyAppOrigin=${RALLY_APP_ORIGIN}"
fi
"$@"
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ai.rally.collaboration/.MainActivity

echo "COSPAN 已安装并启动。"
