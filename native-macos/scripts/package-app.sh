#!/bin/zsh
# Builds dist/Yapper Studio.app.
#
# By default it builds for this Mac only and signs ad hoc, which runs here and
# nowhere else. scripts/release-app.sh sets these to make a build for others:
#
#   YAPPER_UNIVERSAL=1        build for Apple silicon and Intel in one binary
#   YAPPER_SIGN_IDENTITY=...  sign with this Developer ID Application identity,
#                             under the hardened runtime
set -euo pipefail

script_dir=${0:A:h}
project_dir=${script_dir:h}
app_dir="$project_dir/dist/Yapper Studio.app"
contents_dir="$app_dir/Contents"
sign_identity=${YAPPER_SIGN_IDENTITY:--}

build_flags=(--configuration release)
if [[ ${YAPPER_UNIVERSAL:-0} == 1 ]]; then
  build_flags+=(--arch arm64 --arch x86_64)
fi

cd "$project_dir"
swift build "${build_flags[@]}"
bin_dir=$(swift build "${build_flags[@]}" --show-bin-path)

# A build left from another configuration would leave stale files behind.
rm -rf "$app_dir"
mkdir -p "$contents_dir/MacOS" "$contents_dir/Resources" "$contents_dir/Frameworks"
cp "$bin_dir/YapperNative" "$contents_dir/MacOS/YapperNative"
# Sparkle, the updater. The binary looks for it in Contents/Frameworks. ditto
# keeps the framework's version symlinks, which a signed framework needs.
ditto "$bin_dir/Sparkle.framework" "$contents_dir/Frameworks/Sparkle.framework"
cp "$project_dir/Resources/Info.plist" "$contents_dir/Info.plist"
cp "$project_dir/Resources/AppIcon.icns" "$contents_dir/Resources/AppIcon.icns"
# SwiftPM puts the target's resources in their own bundle next to the binary.
# Without this the app launches with no sound effects at all.
cp -R "$bin_dir/YapperNative_YapperNative.bundle" \
  "$contents_dir/Resources/YapperNative_YapperNative.bundle"
# Include dependency privacy manifests in the signed app as well.
for resource_bundle in "$bin_dir"/PostHog_*.bundle(N); do
  cp -R "$resource_bundle" "$contents_dir/Resources/${resource_bundle:t}"
done
# Identify exactly which source the installed app runs, even before a release tag.
build_revision=$(git -C "$project_dir" rev-parse HEAD)
if [[ -n $(git -C "$project_dir" status --porcelain) ]]; then
  build_revision="$build_revision-dirty"
fi
/usr/libexec/PlistBuddy -c "Add :YapperBuildCommit string $build_revision" "$contents_dir/Info.plist"
(cd "$project_dir/.." && node scripts/analytics/native-config.mjs "$contents_dir/Info.plist")
# Nested code is signed first, from the inside out: Sparkle and its helpers,
# then the app. The bundles inside Resources hold no code, so signing the app
# seals them as resources. --deep is not used: Apple advises against it, and it
# would strip the entitlements Sparkle's downloader needs.
"$script_dir/sign-sparkle.sh" "$contents_dir/Frameworks/Sparkle.framework" "$sign_identity"
if [[ $sign_identity == - ]]; then
  codesign --force --sign - "$app_dir"
else
  codesign --force --options runtime --timestamp \
    --entitlements "$project_dir/Resources/YapperNative.entitlements" \
    --sign "$sign_identity" "$app_dir"
fi
codesign --verify --deep --strict --verbose=2 "$app_dir"
print -r -- "$app_dir"
