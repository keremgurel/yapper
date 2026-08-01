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
codesign --force --deep --sign - "$app_dir"
codesign --verify --deep --strict --verbose=2 "$app_dir"
print -r -- "$app_dir"
