#!/usr/bin/env bash
# Tests the cut on one video you finished editing in the Mac app: imports the
# project, transcribes its recording with both transcribers, runs the
# production edit model on each transcript and on the app's own, and lists
# every word it cut or left in against your finished edit.
#   bash scripts/cut-testset/run-real.sh <work folder> <Name.yapperproj> [take name]
set -euo pipefail
work="${1:?work folder}"
project="${2:?path to a .yapperproj}"
here="$(cd "$(dirname "$0")" && pwd)"
providers="dg-nova3,el-scribe2"

name="$(node "$here/add-project.mjs" "$work" "$project" ${3:+"$3"} | tee /dev/stderr | cut -d: -f1)"
mkdir -p "$work/asr" "$work/cut"
node --env-file=.env.local scripts/asr-eval/transcribe.mjs "$work" "$name" "$providers"
node "$here/make-fixtures.mjs" "$work" ${providers//,/ } > /dev/null
fixtures="$(ls "$work"/fixtures/"$name".app.json "$work"/fixtures/"$name".dg-nova3.json "$work"/fixtures/"$name".el-scribe2.json | paste -sd, -)"
tag="real-$name"
rm -f "$work"/cut/"$tag".*.jsonl
node --env-file=.env.local --experimental-strip-types --no-warnings scripts/clean-eval/run-many.mjs \
  --fixtures "$fixtures" --models "${CUT_MODEL:-gemini-3.7-flash}" --runs 2 \
  --concurrency 6 --timeout 300 --outdir "$work/cut" --tag "$tag" 2> /dev/null
node "$here/report-real.mjs" "$work" "$tag"
