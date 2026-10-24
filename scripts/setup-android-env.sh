#!/usr/bin/env bash
set -e

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "$NDK_HOME" ]; then
  if [ -d "$ANDROID_HOME/ndk/27.2.12479018" ]; then
    NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
  elif [ -d "$ANDROID_HOME/ndk" ]; then
    NDK_HOME="$(ls -d "$ANDROID_HOME/ndk/"* 2>/dev/null | tail -n 1)"
  fi
fi

if [ -n "$NDK_HOME" ] && [ -d "$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin" ]; then
  TOOLCHAIN_BIN="$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
  echo "Setting up GNU binutils symlinks in $TOOLCHAIN_BIN..."
  for prefix in aarch64-linux-android arm-linux-androideabi armv7a-linux-androideabi x86_64-linux-android i686-linux-android; do
    [ -f "$TOOLCHAIN_BIN/llvm-ar" ] && ln -sf "$TOOLCHAIN_BIN/llvm-ar" "$TOOLCHAIN_BIN/${prefix}-ar"
    [ -f "$TOOLCHAIN_BIN/llvm-ranlib" ] && ln -sf "$TOOLCHAIN_BIN/llvm-ranlib" "$TOOLCHAIN_BIN/${prefix}-ranlib"
    [ -f "$TOOLCHAIN_BIN/llvm-nm" ] && ln -sf "$TOOLCHAIN_BIN/llvm-nm" "$TOOLCHAIN_BIN/${prefix}-nm"
    [ -f "$TOOLCHAIN_BIN/llvm-as" ] && ln -sf "$TOOLCHAIN_BIN/llvm-as" "$TOOLCHAIN_BIN/${prefix}-as"
    [ -f "$TOOLCHAIN_BIN/llvm-strip" ] && ln -sf "$TOOLCHAIN_BIN/llvm-strip" "$TOOLCHAIN_BIN/${prefix}-strip"
  done
  echo "Symlinks created successfully."
else
  echo "NDK toolchain not found at $NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
fi
