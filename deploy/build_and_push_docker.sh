#!/usr/bin/env bash
# build_and_push_docker.sh – build & push the base-chat-webui images to GHCR.
#
# Steps:
#   1. Preflight: docker daemon, git HEAD/branch, dirty-tree warning
#   2. Build api + web in parallel with --no-cache and stamp the git commit
#      + build time into the image labels. --no-cache is deliberate: a stale
#      BuildKit cache once shipped a pre-fix web bundle (2026-10-19), fresh
#      builds are slower but deterministic.
#   3. Verify the built images carry the current commit (label check) and
#      compare the web bundle name against apps/web/dist (soft warning)
#   4. Push both images to GHCR
#   5. Print the digest chain per image (amd64 manifest + config); the
#      CONFIG digest is the one Portainer shows
#
# Usage:
#   deploy/build_and_push_docker.sh             # build + verify + push (api + web)
#   deploy/build_and_push_docker.sh --no-push   # build + verify only
#   deploy/build_and_push_docker.sh --api       # api image only
#   deploy/build_and_push_docker.sh --web       # web image only
#
# Requirements: docker (daemon running), git, python3, GHCR push access.

set -Eeuo pipefail

REGISTRY="ghcr.io/smoki99"
API_IMAGE="$REGISTRY/base-chat-webui-api:latest"
WEB_IMAGE="$REGISTRY/base-chat-webui-web:latest"

BUILD_API=1
BUILD_WEB=1
DO_PUSH=1

log() {
  printf '\033[1;34m[build-push]\033[0m %s\n' "$*"
}
fail() {
  printf '\033[1;31m[build-push] ERROR:\033[0m %s\n' "$*" >&2
  exit 1
}

# --- arguments ---------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --no-push) DO_PUSH=0 ;;
    --api) BUILD_WEB=0 ;;
    --web) BUILD_API=0 ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fail "unknown option: $arg (see --help)" ;;
  esac
done
if ! ((BUILD_API || BUILD_WEB)); then
  fail "nothing to build (use --api and/or --web)"
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# --- preflight ---------------------------------------------------------------
command -v docker >/dev/null || fail "docker not found"
docker info >/dev/null 2>&1 || fail "docker daemon not reachable"
command -v python3 >/dev/null || fail "python3 not found (needed for the digest lookup)"

HEAD_COMMIT="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
log "repo:   $REPO_ROOT"
log "branch: $BRANCH"
log "commit: $HEAD_COMMIT"
if [[ -n "$(git status --porcelain)" ]]; then
  log "WARNING: working tree is dirty – images will contain uncommitted changes!"
fi

LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

# --- build -------------------------------------------------------------------
build_image() {
  local name="$1"
  local dockerfile="$2"
  local image="$3"
  local log_file="$4"
  log "[$name] building (fresh, --no-cache) …"
  docker build --no-cache \
    --label "com.base-chat.commit=$HEAD_COMMIT" \
    --label "com.base-chat.built-at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -f "$dockerfile" -t "$image" . >"$log_file" 2>&1 || {
      log "[$name] FAILED – last lines of the build log:"
      tail -15 "$log_file" >&2
      return 1
    }
  log "[$name] built"
}

PIDS=()
if ((BUILD_API)); then
  build_image api apps/api/Dockerfile "$API_IMAGE" "$LOG_DIR/api.log" &
  PIDS+=("$!")
fi
if ((BUILD_WEB)); then
  build_image web apps/web/Dockerfile "$WEB_IMAGE" "$LOG_DIR/web.log" &
  PIDS+=("$!")
fi

BUILD_RC=0
for pid in "${PIDS[@]}"; do
  wait "$pid" || BUILD_RC=1
done
if ((BUILD_RC != 0)); then
  fail "one or more builds failed (see above)"
fi

# --- verify ------------------------------------------------------------------
verify_commit_label() {
  local image="$1"
  local name="$2"
  local actual
  actual="$(docker image inspect "$image" --format '{{index .Config.Labels "com.base-chat.commit"}}' 2>/dev/null || true)"
  if [[ "$actual" != "$HEAD_COMMIT" ]]; then
    fail "[$name] commit label '${actual:-<missing>}' != HEAD '$HEAD_COMMIT' – image is stale, aborting before push"
  fi
  log "[$name] OK – built from $actual"
}
if ((BUILD_API)); then
  verify_commit_label "$API_IMAGE" api
fi
if ((BUILD_WEB)); then
  verify_commit_label "$WEB_IMAGE" web
fi

# Soft check: web bundle in the image vs. local dist (if present).
if ((BUILD_WEB)) && [[ -d apps/web/dist/assets ]]; then
  img_bundle="$(docker run --rm --entrypoint sh "$WEB_IMAGE" -c 'ls /usr/share/nginx/html/assets/' | grep -E '\.js$' || true)"
  local_bundle="$(ls apps/web/dist/assets | grep -E '\.js$' | head -1)"
  if [[ -n "$local_bundle" && "$img_bundle" != "$local_bundle" ]]; then
    log "WARNING: web bundle in image ($img_bundle) != local dist ($local_bundle)"
    log "         (harmless if apps/web/dist is stale – the commit label check is authoritative)"
  fi
fi

# --- push --------------------------------------------------------------------
if ((DO_PUSH)); then
  PUSH_LOG="$LOG_DIR/push.log"
  {
    if ((BUILD_API)); then
      docker push "$API_IMAGE"
    fi
    if ((BUILD_WEB)); then
      docker push "$WEB_IMAGE"
    fi
  } >"$PUSH_LOG" 2>&1 || {
    tail -15 "$PUSH_LOG" >&2
    fail "push failed"
  }
  log "pushed (index digests):"
  grep -E '^latest: digest' "$PUSH_LOG" | sed 's/^/  /'
else
  log "skipping push (--no-push)"
fi

# --- digest chain (what to check in Portainer) -------------------------------
digest_chain() {
  local image="$1"
  local amd64 config
  amd64="$(
    docker manifest inspect "$image" | python3 -c '
import sys, json
d = json.load(sys.stdin)
print([m["digest"] for m in d["manifests"] if m["platform"]["architecture"] == "amd64"][0])
'
  )"
  config="$(
    docker manifest inspect "$image@$amd64" | python3 -c '
import sys, json
print(json.load(sys.stdin)["config"]["digest"])
'
  )"
  log "digest chain – $image"
  log "  amd64 manifest    : $amd64"
  log "  config (Portainer): $config"
}
if ((DO_PUSH)); then
  if ((BUILD_API)); then
    digest_chain "$API_IMAGE"
  fi
  if ((BUILD_WEB)); then
    digest_chain "$WEB_IMAGE"
  fi
  log "done – on the Portainer host: pull + up -d, then verify the digests above"
else
  log "done (no push; digests not printed)"
fi

