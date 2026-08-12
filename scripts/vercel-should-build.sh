#!/usr/bin/env bash
#
# Vercel's Ignored Build Step. Exit 0 to skip the build, exit 1 to run it.
#
# This repository holds two products: the Next.js site and the native macOS
# editor in `native-macos/`. Every commit to either one used to trigger a full
# production build and deployment of the site, so a Swift-only change — a
# transcript button, an export fix, a test — paid for a web build that could not
# possibly change the web output. Over a recent ten-day stretch that was 25 of
# 58 production builds: roughly 43% of the build bill, spent on nothing.
#
# The rule is deliberately one-directional: anything not on the ignore list
# builds. A path nobody thought about is a path that gets built, which is the
# cheap way to be wrong. The same goes for every uncertainty below — no previous
# SHA, an unreachable SHA, a git failure — all of them build.
set -uo pipefail

# The commit being deployed. Vercel checks it out as HEAD; taking it as an
# argument is what lets this be replayed over real history to check the rule
# before trusting it with the build bill.
head="${1:-HEAD}"

# Paths that cannot affect what the site serves. `content/` is deliberately
# absent: the blog posts under it are pages, so they must build.
IGNORED='^(native-macos/|docs/|\.github/|README\.md$|AGENTS\.md$|CLAUDE\.md$)'

build() { echo "▲ Building: $1"; exit 1; }
skip() { echo "▲ Skipped: $1"; exit 0; }

# Preview deployments are not used here: Clerk will not accept the generated
# preview domains, so a preview URL cannot get past sign-in and nobody opens
# them. They were still the larger half of the build bill. Production still
# deploys automatically from main.
#
# Tested for "preview" explicitly rather than "not production". If this variable
# were ever missing, the opposite test would silently skip production builds,
# and a build that should not have run is a much cheaper mistake than a
# production deploy that never did.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  skip "preview deployments are disabled for this project"
fi

base="${VERCEL_GIT_PREVIOUS_SHA:-}"

# The SHA of the last successful deployment, which is the honest base: if three
# Swift-only commits were skipped in a row and the fourth touches the site, the
# diff still spans all four. `HEAD^` would only see the last one.
if [ -z "$base" ]; then
  build "no previous deployment to compare against"
fi

if ! git cat-file -e "${base}^{commit}" 2>/dev/null; then
  # A shallow clone that does not reach back to the last deployment. Fetching
  # more is not worth a wrong answer.
  build "previous deployment ${base:0:7} is not in this clone"
fi

changed=$(git diff --name-only "$base" "$head" 2>/dev/null) || build "could not diff against ${base:0:7}"

if [ -z "$changed" ]; then
  skip "no files changed since ${base:0:7}"
fi

# grep exits 1 for "no lines matched" and 2+ for "something went wrong". Only
# the first means the list is legitimately empty; a `|| true` here would turn a
# broken pattern into "skip every build".
relevant=$(printf '%s\n' "$changed" | grep -Ev "$IGNORED")
status=$?
if [ "$status" -gt 1 ]; then
  build "could not classify the changed files (grep exited $status)"
fi

if [ -z "$relevant" ]; then
  skip "$(printf '%s\n' "$changed" | wc -l | tr -d ' ') changed files, none of them the site"
fi

build "$(printf '%s\n' "$relevant" | wc -l | tr -d ' ') site files changed"
