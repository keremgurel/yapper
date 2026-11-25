#!/bin/zsh
# Signs an embedded Sparkle.framework, inside out.
#
#   scripts/sign-sparkle.sh <path to Sparkle.framework> <identity>
#
# Called by package-app.sh before it signs the app. The identity is a
# Developer ID, or - for an ad hoc build. Every helper Sparkle carries is code
# of its own, so each gets the hardened runtime and, for Developer ID, a secure
# timestamp, or notarization rejects the app. The order follows Sparkle's
# documentation: the XPC services, the installer tools, then the framework.
# The downloader keeps its entitlements, which let it reach the network.
set -euo pipefail

framework=$1
identity=$2
version_dir="$framework/Versions/B"

timestamp=--timestamp
[[ $identity == - ]] && timestamp=--timestamp=none

sign() {
  codesign --force --options runtime $timestamp --sign "$identity" "$@"
}

sign "$version_dir/XPCServices/Installer.xpc"
sign --preserve-metadata=entitlements "$version_dir/XPCServices/Downloader.xpc"
sign "$version_dir/Autoupdate"
sign "$version_dir/Updater.app"
sign "$framework"
