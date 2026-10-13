#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${JAVA_HOME:-}" ]]; then
  for candidate in "$HOME"/.cache/hongguotv/toolchain/jdk-17*/Contents/Home; do
    [[ -x "$candidate/bin/java" ]] && export JAVA_HOME="$candidate" && break
  done
fi
if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/.cache/hongguotv/android-sdk" ]]; then
  export ANDROID_HOME="$HOME/.cache/hongguotv/android-sdk"
fi
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK directory}"
if [[ ! -f android/app/debug.keystore ]]; then
  "${JAVA_HOME:+$JAVA_HOME/bin/}keytool" -genkeypair -noprompt -storetype JKS \
    -keystore android/app/debug.keystore -storepass android -keypass android \
    -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname 'CN=Android Debug,O=Android,C=US'
fi
# Sideloadable release bundle signed with the development key; no Metro required.
# Use a private release key for public distribution.
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a --console=plain)
version="$(node -p "require('./package.json').version")"
mkdir -p outputs
cp android/app/build/outputs/apk/release/app-release.apk "outputs/hongguotv-${version}-android8.apk"
shasum -a 256 "outputs/hongguotv-${version}-android8.apk" > outputs/SHA256SUMS
