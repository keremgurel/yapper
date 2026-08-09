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
codesign --force --deep --sign - "$app_dir"
codesign --verify --deep --strict --verbose=2 "$app_dir"
print -r -- "$app_dir"
