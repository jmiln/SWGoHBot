#!/usr/bin/env bash
# Prints commit subjects since the last tag, grouped by conventional-commit type.
# Output is a starting point to paste into CHANGELOG.md and edit, not a finished changelog.
set -euo pipefail

LAST_TAG=$(git describe --tags --abbrev=0 --match '[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)
if [ -z "$LAST_TAG" ]; then
    echo "No semver tag found, so there is no starting point to diff from." >&2
    echo "Tag a baseline first. The commit where package.json became 3.0.0 is:" >&2
    echo "  git tag -a 3.0.0 d1b0b21d -m 'TypeScript migration baseline'" >&2
    exit 1
fi

echo "Commits since ${LAST_TAG}:"
echo

print_group() {
    local prefix=$1 heading=$2
    local lines
    lines=$(git log --no-merges --pretty='%s' "${LAST_TAG}..HEAD" | grep -E "^${prefix}(\(.+\))?: " || true)
    if [ -n "$lines" ]; then
        echo "### ${heading}"
        echo
        echo "$lines" | sed -E "s/^${prefix}(\(.+\))?: //" | sed 's/^/- /'
        echo
    fi
}

# Every conventional-commit type this repo uses gets a group. Anything left over lands in
# "Unclassified" rather than being silently dropped, so a badly-prefixed commit is visible.
print_group feat Added
print_group fix Fixed
print_group perf Performance
print_group refactor Refactoring
print_group docs Documentation
print_group ci CI
print_group build Build
print_group test Tests
print_group chore Chores

KNOWN='feat|fix|perf|refactor|docs|ci|build|test|chore'
OTHER=$(git log --no-merges --pretty='%s' "${LAST_TAG}..HEAD" | grep -vE "^(${KNOWN})(\(.+\))?: " || true)
if [ -n "$OTHER" ]; then
    echo "### Unclassified (no conventional prefix)"
    echo
    echo "$OTHER" | sed 's/^/- /'
    echo
fi
