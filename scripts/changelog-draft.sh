#!/usr/bin/env bash
set -euo pipefail

CHANGELOG="$(dirname "$0")/../CHANGELOG.md"
WRITE=0
RELEASE=""
STAGE=0

usage() {
    cat <<'USAGE'
Groups commit subjects since the last tag by conventional-commit type.

Releasing is automatic; this is only needed to look at or fix up the changelog by hand:

  npm run changelog:draft              print to stdout, write nothing
  npm run changelog:write              regenerate the [Unreleased] section
  npm run changelog:release -- 4.6.0   move [Unreleased] under 4.6.0

Those npm scripts already supply the flags below, so pass only the version. npm needs the bare --
to hand an argument through to the script; without it npm reads the argument as its own.

Direct invocation:

  scripts/changelog-draft.sh [--write] [--release X.Y.Z] [--stage]

  --write     regenerate the [Unreleased] section in CHANGELOG.md
  --release   move [Unreleased] under the given version and open a fresh one
  --stage     git add CHANGELOG.md afterwards; used by the version lifecycle hook
USAGE
}

while [ $# -gt 0 ]; do
    case "$1" in
        --write) WRITE=1 ;;
        --stage) STAGE=1 ;;
        --release)
            shift
            RELEASE="${1:-}"
            if [ -z "$RELEASE" ]; then
                echo "--release needs a version, e.g. --release 4.6.0" >&2
                exit 1
            fi
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
    shift
done

LAST_TAG=$(git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
if [ -z "$LAST_TAG" ]; then
    echo "No semver tag found, so there is no starting point to diff from." >&2
    echo "Tag a baseline first. The commit where package.json became 3.0.0 is:" >&2
    echo "  git tag -a 3.0.0 d1b0b21d -m 'TypeScript migration baseline'" >&2
    exit 1
fi

# `npm version` commits the bump with the bare version as its subject. That is not a change.
subjects() {
    git log --no-merges --pretty='%s' "${1}" | grep -vE '^[0-9]+\.[0-9]+\.[0-9]+$' || true
}

print_group() {
    local range=$1 prefix=$2 heading=$3
    local lines
    lines=$(subjects "$range" | grep -E "^${prefix}(\(.+\))?: " || true)
    if [ -n "$lines" ]; then
        echo "### ${heading}"
        echo
        echo "$lines" | sed -E "s/^${prefix}(\(.+\))?: //" | sed 's/^/- /'
        echo
    fi
}

KNOWN='feat|fix|perf|refactor|docs|ci|build|test|chore'

render() {
    local range=$1
    print_group "$range" feat Added
    print_group "$range" fix Fixed
    print_group "$range" perf Performance
    print_group "$range" refactor Refactoring
    print_group "$range" docs Documentation
    print_group "$range" ci CI
    print_group "$range" build Build
    print_group "$range" test Tests
    print_group "$range" chore Chores

    # Surfaced rather than dropped, so a badly-prefixed commit stays visible.
    local other
    other=$(subjects "$range" | grep -vE "^(${KNOWN})(\(.+\))?: " || true)
    if [ -n "$other" ]; then
        echo "### Unclassified (no conventional prefix)"
        echo
        echo "$other" | sed 's/^/- /'
        echo
    fi
}

RANGE="${LAST_TAG}..HEAD"

if [ "$WRITE" -eq 0 ] && [ -z "$RELEASE" ]; then
    echo "Commits since ${LAST_TAG}:"
    echo
    render "$RANGE"
    exit 0
fi

# A release removes the heading, so it is reinstated above the newest version rather than being
# required to exist.
if ! grep -q '^## \[Unreleased\]' "$CHANGELOG"; then
    if ! grep -q '^## \[' "$CHANGELOG"; then
        echo "No version headings in ${CHANGELOG}; refusing to guess where to write." >&2
        exit 1
    fi
    awk '
        !inserted && /^## \[/ { print "## [Unreleased]"; print ""; inserted = 1 }
        { print }
    ' "$CHANGELOG" > "${CHANGELOG}.tmp" && mv "${CHANGELOG}.tmp" "$CHANGELOG"
fi

if [ -n "$RELEASE" ] && grep -q "^## \[${RELEASE}\]" "$CHANGELOG"; then
    echo "${CHANGELOG} already has a '## [${RELEASE}]' section, so this would duplicate it." >&2
    exit 1
fi

body=$(render "$RANGE")
[ -n "$body" ] || body="- Nothing yet."

# Replaces the section rather than appending, so repeat runs stay idempotent.
awk -v body="$body" '
    /^## \[Unreleased\]/ { print; print ""; print body; print ""; skipping = 1; next }
    skipping && /^## \[/  { skipping = 0 }
    !skipping             { print }
' "$CHANGELOG" > "${CHANGELOG}.tmp"

if [ -n "$RELEASE" ]; then
    awk -v version="$RELEASE" -v today="$(date +%F)" '
        /^## \[Unreleased\]/ { print "## [" version "] - " today; next }
        { print }
    ' "${CHANGELOG}.tmp" > "${CHANGELOG}.tmp2"
    mv "${CHANGELOG}.tmp2" "${CHANGELOG}.tmp"
fi

mv "${CHANGELOG}.tmp" "$CHANGELOG"

if [ "$STAGE" -eq 1 ]; then
    git add "$CHANGELOG"
fi
echo "Updated ${CHANGELOG}${RELEASE:+ for ${RELEASE}}"
