#!/usr/bin/env bash
#
# build-in-docker.sh — build the Dubuntu ISO inside an Ubuntu 24.04 container.
#
# Use this when the host is not Ubuntu 24.04 (Debian, Fedora, macOS, CI) or
# when you would rather not apt-install the live-build toolchain on your machine.
#
#   ./scripts/build-in-docker.sh                 # build
#   ./scripts/build-in-docker.sh --clean         # wipe tree, rebuild
#   ./scripts/build-in-docker.sh --install-deps  # ignored inside the image
#
# The ISO lands in ./build/out/ on the host. Needs Docker with --privileged
# support (loop devices + mounts are required by live-build).
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
IMAGE="${DUBUNTU_BUILD_IMAGE:-dubuntu-iso-builder}"

log()  { printf '\033[34m[dubuntu]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[dubuntu]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "Docker not found. Install Docker, or run ./scripts/build.sh on an Ubuntu 24.04 host."

if ! docker info >/dev/null 2>&1; then
  die "Cannot talk to the Docker daemon. Start Docker (or fix permissions) and retry."
fi

if [ "${DUBUNTU_SKIP_IMAGE_BUILD:-0}" != "1" ]; then
  log "Building builder image ${IMAGE} (cached after the first run)"
  docker build -t "$IMAGE" -f "${SCRIPT_DIR}/Dockerfile.build" "$SCRIPT_DIR"
fi

# Forward the supported DUBUNTU_* knobs into the container.
env_args=()
for var in DUBUNTU_VERSION DUBUNTU_CODENAME DUBUNTU_DISTRIBUTION DUBUNTU_ARCH \
           DUBUNTU_MIRROR DUBUNTU_SECURITY_MIRROR DUBUNTU_ISO_NAME; do
  if [ -n "${!var:-}" ]; then
    env_args+=(-e "${var}=${!var}")
  fi
done

mkdir -p "${ROOT_DIR}/build/out"

log "Running build inside ${IMAGE}"
docker run --rm -it \
  --privileged \
  --security-opt apparmor=unconfined \
  -v "${ROOT_DIR}:/build" \
  -w /build \
  -e DEBIAN_FRONTEND=noninteractive \
  "${env_args[@]}" \
  "$IMAGE" \
  ./scripts/build.sh "$@"
