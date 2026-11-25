#!/bin/zsh
# Builds the Mac download: a universal app signed with Developer ID,
# notarized by Apple, inside a notarized disk image.
#
#   scripts/release-app.sh
#
# Writes dist/Yapper-Studio-<version>.dmg, a copy at dist/Yapper-Studio.dmg
# (the name the site links to), and dist/appcast.xml, the signed feed that tells
# installed copies about this version. Nothing is uploaded.
#
# Needs, once per Mac (see README, "Release"):
#   a "Developer ID Application" certificate in the login keychain,
#   notarytool credentials saved under the profile name below, and
#   the Sparkle EdDSA key in the login keychain (account yapper-studio).
#
#   YAPPER_SIGN_IDENTITY   the identity to sign with, when the keychain has more
#                          than one Developer ID Application certificate
#   YAPPER_NOTARY_PROFILE  the notarytool keychain profile (default yapper-notary)
set -euo pipefail

script_dir=${0:A:h}
project_dir=${script_dir:h}
dist_dir="$project_dir/dist"
app_name="Yapper Studio.app"
app_dir="$dist_dir/$app_name"
notary_profile=${YAPPER_NOTARY_PROFILE:-yapper-notary}

fail() {
  print -u2 -- "$1"
  exit 1
}

# A download has to be traceable to a commit, so the tree must be clean.
if [[ -n $(git -C "$project_dir" status --porcelain) ]]; then
  fail "The working tree has changes. Commit or set them aside, then run this again."
fi

identity=${YAPPER_SIGN_IDENTITY:-}
if [[ -z $identity ]]; then
  identities=("${(@f)$(security find-identity -v -p codesigning \
    | sed -n 's/.*"\(Developer ID Application: .*\)"$/\1/p' | sort -u)}")
  identities=(${identities:#})
  case ${#identities} in
    0) fail "No Developer ID Application certificate in the keychain. See README, \"Release\"." ;;
    1) identity=${identities[1]} ;;
    *) fail "More than one Developer ID Application certificate. Set YAPPER_SIGN_IDENTITY to one of:
${(F)identities}" ;;
  esac
fi

# Checked before the build, so a missing profile fails in seconds, not minutes.
if ! xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null 2>&1; then
  fail "No notarytool credentials under \"$notary_profile\". See README, \"Release\"."
fi
sparkle_key=$(security find-generic-password -s "https://sparkle-project.org" \
  -a "${YAPPER_SPARKLE_ACCOUNT:-yapper-studio}" 2>/dev/null || true)
if [[ -z $sparkle_key ]]; then
  fail "No Sparkle update key in the keychain. See README, \"Release\"."
fi

work_dir=$(mktemp -d "${TMPDIR:-/tmp}/yapper-release-XXXXXXXX")
trap 'rm -rf "$work_dir"' EXIT
trap 'exit 130' INT TERM

# Sends a file to Apple and waits. On rejection, prints Apple's log of why.
notarize() {
  local file=$1 result="$work_dir/notary-result.json"
  print -u2 -- "Notarizing ${file:t}. This usually takes a few minutes."
  xcrun notarytool submit "$file" --keychain-profile "$notary_profile" \
    --wait --output-format json >"$result"
  local notary_status=$(plutil -extract status raw -o - "$result")
  if [[ $notary_status != Accepted ]]; then
    local submission=$(plutil -extract id raw -o - "$result")
    xcrun notarytool log "$submission" --keychain-profile "$notary_profile" >&2 || true
    fail "Apple did not accept ${file:t}: $notary_status"
  fi
}

print -u2 -- "Signing as $identity"
YAPPER_UNIVERSAL=1 YAPPER_SIGN_IDENTITY=$identity "$script_dir/package-app.sh" >/dev/null

# The app is notarized and stapled on its own first, so it still opens after
# it is dragged out of the disk image onto a Mac that is offline.
app_zip="$work_dir/app.zip"
ditto -c -k --keepParent "$app_dir" "$app_zip"
notarize "$app_zip"
xcrun stapler staple "$app_dir"

version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$app_dir/Contents/Info.plist")
dmg="$dist_dir/Yapper-Studio-$version.dmg"
stage="$work_dir/dmg"
mkdir -p "$stage"
ditto "$app_dir" "$stage/$app_name"
ln -s /Applications "$stage/Applications"
rm -f "$dmg"
hdiutil create -volname "Yapper Studio" -srcfolder "$stage" -fs HFS+ \
  -format UDZO -ov "$dmg" >/dev/null
codesign --force --timestamp --sign "$identity" "$dmg"
notarize "$dmg"
xcrun stapler staple "$dmg"

# What Gatekeeper will ask on someone else's Mac.
spctl --assess --type execute --verbose=2 "$app_dir"
spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg"
xcrun stapler validate "$dmg"

rm -f "$dist_dir/Yapper-Studio.dmg"
cp -c "$dmg" "$dist_dir/Yapper-Studio.dmg"
"$script_dir/make-appcast.sh" "$app_dir" "$dmg" >/dev/null
print -r -- "$dmg"
print -r -- "$dist_dir/appcast.xml"
