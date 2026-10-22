#!/usr/bin/env bash
#
# Links the ignored local env files from the main checkout into this worktree,
# so a dev server started here uses the same dev Clerk instance and dev
# services. Files that already exist here are left alone. Only development
# files are listed; never add a production one.
#
#   bash scripts/link-worktree-env.sh
set -euo pipefail

FILES=(.env.local)

here=$(git rev-parse --show-toplevel)
main=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
if [ "$here" = "$main" ]; then
  echo "This is the main checkout; nothing to link."
  exit 0
fi

for file in "${FILES[@]}"; do
  if [ -e "$here/$file" ]; then
    echo "kept     $file"
  elif [ -e "$main/$file" ]; then
    ln -s "$main/$file" "$here/$file"
    echo "linked   $file"
  else
    echo "missing  $file (not in $main either)"
  fi
done
