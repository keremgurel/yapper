#!/bin/zsh
set -euo pipefail

script_dir=${0:A:h}
project_dir=${script_dir:h}
app_dir="$project_dir/dist/Yapper Studio Native.app"
contents_dir="$app_dir/Contents"

cd "$project_dir"
swift build --configuration release

mkdir -p "$contents_dir/MacOS" "$contents_dir/Resources"
cp "$project_dir/.build/release/YapperNative" "$contents_dir/MacOS/YapperNative"
cp "$project_dir/Resources/Info.plist" "$contents_dir/Info.plist"
cp "$project_dir/Resources/AppIcon.icns" "$contents_dir/Resources/AppIcon.icns"
# SwiftPM puts the target's resources in their own bundle next to the binary.
# Without this the app launches with no sound effects at all.
rm -rf "$contents_dir/Resources/YapperNative_YapperNative.bundle"
cp -R "$project_dir/.build/release/YapperNative_YapperNative.bundle" \
  "$contents_dir/Resources/YapperNative_YapperNative.bundle"
# Include dependency privacy manifests in the signed app as well.
for resource_bundle in "$project_dir"/.build/release/PostHog_*.bundle(N); do
  bundle_name=${resource_bundle:t}
  rm -rf "$contents_dir/Resources/$bundle_name"
  cp -R "$resource_bundle" "$contents_dir/Resources/$bundle_name"
done
# Identify exactly which source the installed app runs, even before a release tag.
build_revision=$(git -C "$project_dir" rev-parse HEAD)
if [[ -n $(git -C "$project_dir" status --porcelain) ]]; then
  build_revision="$build_revision-dirty"
fi
/usr/libexec/PlistBuddy -c "Add :YapperBuildCommit string $build_revision" "$contents_dir/Info.plist"
(cd "$project_dir/.." && node scripts/analytics/native-config.mjs "$contents_dir/Info.plist")
codesign --force --deep --sign - "$app_dir"
codesign --verify --deep --strict --verbose=2 "$app_dir"
print -r -- "$app_dir"
