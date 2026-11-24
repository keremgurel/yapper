#!/usr/bin/env bash
# Transcribes every take with both transcribers, then runs the production edit
# model on each transcript twice. Needs the provider keys in .env.local.
#   bash scripts/cut-testset/run.sh <work folder> [tag]
set -euo pipefail
work="${1:?work folder}"
tag="${2:-r1}"
here="$(cd "$(dirname "$0")" && pwd)"
providers="dg-nova3,el-scribe2"
takes="$(node -e "import('$here/takes.mjs').then(m=>console.log(m.TAKES.map(t=>t.id).join(',')))")"

mkdir -p "$work/asr" "$work/cut"
node --env-file=.env.local scripts/asr-eval/transcribe.mjs "$work" "$takes" "$providers"
node "$here/make-fixtures.mjs" "$work" ${providers//,/ }
fixtures="$(ls "$work"/fixtures/*.dg-nova3.json "$work"/fixtures/*.el-scribe2.json | paste -sd, -)"
node --env-file=.env.local --experimental-strip-types --no-warnings scripts/clean-eval/run-many.mjs \
  --fixtures "$fixtures" --models "${CUT_MODEL:-gemini-3.7-flash}" --runs 2 \
  --concurrency 8 --timeout 180 --outdir "$work/cut" --tag "$tag"
echo "done"
