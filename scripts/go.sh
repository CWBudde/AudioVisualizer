#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export GOCACHE="$PWD/.cache/go-build"
export GOMODCACHE="$PWD/.cache/go-mod"
exec go "$@"
