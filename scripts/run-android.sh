#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ -z "$NDK_HOME" ]; then
  if [ -d "$ANDROID_HOME/ndk/27.2.12479018" ]; then
    export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
  elif [ -d "$ANDROID_HOME/ndk" ]; then
    export NDK_HOME="$(ls -d "$ANDROID_HOME/ndk/"* 2>/dev/null | tail -n 1)"
  fi
fi

if [ -n "$NDK_HOME" ] && [ -d "$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin" ]; then
  TOOLCHAIN_BIN="$NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"
  export PATH="$TOOLCHAIN_BIN:/usr/local/bin:/opt/homebrew/bin:$PATH"
fi

export OPENSSL_STATIC=1
export AR_aarch64_linux_android=llvm-ar
export RANLIB_aarch64_linux_android=llvm-ranlib
export RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384 ${RUSTFLAGS:-}"

exec npx tauri android "$@"
