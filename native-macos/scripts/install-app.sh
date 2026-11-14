#!/bin/zsh
# Installs a packaged build as /Applications/Yapper Studio Native.app.
#
#   scripts/install-app.sh [path/to/Yapper Studio Native.app]
#
# YAPPER_INSTALL_DIR replaces /Applications, for trying this out safely.
#
# The new bundle is copied into a staging folder next to the installed one,
# so the swap itself is two renames on one volume. The previous app stays in
# that folder only until the new one is in place and verified, then the
# folder is removed. If anything fails after the old app has moved aside, it
# is put back. Either way no /Applications/.yapper-update-* folder is left.
set -euo pipefail

script_dir=${0:A:h}
project_dir=${script_dir:h}
source_app=${1:-"$project_dir/dist/Yapper Studio Native.app"}
install_dir=${YAPPER_INSTALL_DIR:-/Applications}
target_app="$install_dir/Yapper Studio Native.app"
running_pattern="^$target_app/Contents/MacOS/YapperNative"
bundle_id=com.yapper.studio.native

if [[ ! -d $source_app ]]; then
  print -u2 -- "No app at $source_app. Run scripts/package-app.sh first."
  exit 1
fi
codesign --verify --deep --strict "$source_app"

# Quit the installed app the way Cmd-Q does, so an export in progress can
# finish or be cancelled and clean up after itself. Killing it would leave
# that export's files in the temp folder.
was_running=false
if pgrep -qf "$running_pattern"; then
  was_running=true
  osascript -e "tell application id \"$bundle_id\" to quit" >/dev/null 2>&1 || true
  for _ in {1..60}; do
    pgrep -qf "$running_pattern" || break
    sleep 1
  done
  if pgrep -qf "$running_pattern"; then
    print -u2 -- "Yapper Studio Native is still open, maybe asking about a running export. Quit it, then run this again."
    exit 1
  fi
fi

staging=$(mktemp -d "$install_dir/.yapper-update-XXXXXXXX")
staged_app="$staging/Yapper Studio Native.app"
previous_app="$staging/Previous Yapper Studio Native.app"

cleanup() {
  if [[ ! -e $target_app && -e $previous_app ]]; then
    if ! mv "$previous_app" "$target_app"; then
      print -u2 -- "Could not put the previous app back. It is in $staging."
      return
    fi
  fi
  rm -rf "$staging"
}
trap cleanup EXIT
# zsh skips the EXIT trap when a signal ends the script, so Ctrl-C mid-swap
# would leave the staging folder behind, or no app in place at all.
trap 'exit 130' INT TERM

ditto "$source_app" "$staged_app"
if [[ -e $target_app ]]; then
  mv "$target_app" "$previous_app"
fi
mv "$staged_app" "$target_app"
if ! codesign --verify --deep --strict "$target_app"; then
  # Out of the way, so cleanup puts the previous app back.
  mv "$target_app" "$staging/Rejected Yapper Studio Native.app"
  print -u2 -- "The installed copy failed verification. The previous app is back."
  exit 1
fi

print -r -- "$target_app"
if $was_running; then
  open "$target_app"
fi
