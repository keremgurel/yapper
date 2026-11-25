#!/bin/zsh
# Writes the signed Sparkle appcast for one release.
#
#   scripts/make-appcast.sh <app> <dmg>
#
# release-app.sh runs this last. It writes dist/appcast.xml, which names the
# version inside <app> and points at <dmg> as published on the GitHub release.
# The disk image and the feed are both signed with the EdDSA key in the login
# keychain, so the installed app accepts neither if either is changed. Nothing
# is uploaded.
#
#   YAPPER_SPARKLE_ACCOUNT  the keychain account holding the key
#                           (default yapper-studio)
#   YAPPER_DOWNLOAD_BASE    where the disk image will be downloaded from, for a
#                           local test (default: the release's GitHub download
#                           folder, tagged v<version>)
set -euo pipefail

script_dir=${0:A:h}
project_dir=${script_dir:h}
app=$1
dmg=$2
account=${YAPPER_SPARKLE_ACCOUNT:-yapper-studio}
repo_url=https://github.com/keremgurel/yapper
sign_update="$project_dir/.build/artifacts/sparkle/Sparkle/bin/sign_update"
appcast="$project_dir/dist/appcast.xml"

fail() {
  print -u2 -- "$1"
  exit 1
}

[[ -x $sign_update ]] || fail "Sparkle's sign_update is missing. Run swift build first."

plist="$app/Contents/Info.plist"
read_plist() { /usr/libexec/PlistBuddy -c "Print :$1" "$plist"; }
version=$(read_plist CFBundleShortVersionString)
build=$(read_plist CFBundleVersion)
minimum_system=$(read_plist LSMinimumSystemVersion)
download_base=${YAPPER_DOWNLOAD_BASE:-$repo_url/releases/download/v$version}

# Sparkle compares build numbers. One that is not higher than the build already
# out there is never offered, so catch it now rather than after publishing.
if [[ -z ${YAPPER_DOWNLOAD_BASE:-} ]]; then
  published=$(curl -fsL "$repo_url/releases/latest/download/appcast.xml" 2>/dev/null \
    | sed -n 's:.*<sparkle\:version>\([0-9]*\)</sparkle\:version>.*:\1:p' | head -1 || true)
  if [[ -n $published ]] && (( build <= published )); then
    fail "CFBundleVersion is $build, but build $published is already published. Raise it in Resources/Info.plist."
  fi
fi

# Prints sparkle:edSignature="..." length="..." for the enclosure.
enclosure_signature=$("$sign_update" --account "$account" "$dmg")

cat >"$appcast" <<XML
<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Yapper Studio</title>
    <link>$repo_url/releases</link>
    <item>
      <title>Yapper Studio $version</title>
      <pubDate>$(LC_ALL=C date -u "+%a, %d %b %Y %H:%M:%S +0000")</pubDate>
      <link>$repo_url/releases/tag/v$version</link>
      <sparkle:version>$build</sparkle:version>
      <sparkle:shortVersionString>$version</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>$minimum_system</sparkle:minimumSystemVersion>
      <enclosure url="$download_base/${dmg:t}" $enclosure_signature type="application/octet-stream"/>
    </item>
  </channel>
</rss>
XML

# Embeds the feed's own signature as a comment at the end of the file.
"$sign_update" --account "$account" "$appcast"
"$sign_update" --account "$account" --verify "$appcast" >/dev/null
print -r -- "$appcast"
