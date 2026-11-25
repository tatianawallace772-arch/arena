#!/usr/bin/env bash
#
# build.sh — build the Dubuntu live ISO with live-build.
#
#   sudo ./scripts/build.sh                 # configure + build
#   sudo ./scripts/build.sh --install-deps  # apt install live-build toolchain first
#   sudo ./scripts/build.sh --clean         # wipe the live-build tree, then rebuild
#   ./scripts/build.sh --dry-run            # show what would run (no root needed)
#
# Output:
#   build/out/dubuntu-<version>-<arch>.iso
#   build/out/dubuntu-<version>-<arch>.iso.sha256
#   build/out/SHA256SUMS
#
# Override anything with environment variables, e.g.:
#   sudo DUBUNTU_VERSION=24.04 DUBUNTU_ARCH=amd64 \
#        DUBUNTU_MIRROR=http://ftp.osuosl.org/pub/ubuntu/ ./scripts/build.sh
#
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

BUILD_DIR="${ROOT_DIR}/build"
WORK_DIR="${BUILD_DIR}/lb"
OUT_DIR="${BUILD_DIR}/out"
LOG_FILE="${BUILD_DIR}/build.log"

DUBUNTU_VERSION="${DUBUNTU_VERSION:-24.04}"
DUBUNTU_CODENAME="${DUBUNTU_CODENAME:-Dub Jam}"
DUBUNTU_DISTRIBUTION="${DUBUNTU_DISTRIBUTION:-noble}"
DUBUNTU_ARCH="${DUBUNTU_ARCH:-amd64}"
DUBUNTU_MIRROR="${DUBUNTU_MIRROR:-http://archive.ubuntu.com/ubuntu/}"
DUBUNTU_SECURITY_MIRROR="${DUBUNTU_SECURITY_MIRROR:-http://security.ubuntu.com/ubuntu/}"
DUBUNTU_ISO_NAME="${DUBUNTU_ISO_NAME:-dubuntu-${DUBUNTU_VERSION}-${DUBUNTU_ARCH}.iso}"

DEB_PACKAGES=(
  live-build
  debootstrap
  squashfs-tools
  xorriso
  isolinux
  grub-pc-bin
  grub-efi-amd64-bin
  grub-efi-amd64-signed
  shim-signed
  ubuntu-keyring
  mtools
  dosfstools
  rsync
  ca-certificates
)

ORIG_ARGS="$*"
INSTALL_DEPS=0
CLEAN=0
DRY_RUN=0
KEEP_WORK=1

# ---------------------------------------------------------------- helpers --
c_reset=$'\033[0m'; c_bold=$'\033[1m'; c_blue=$'\033[34m'
c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_red=$'\033[31m'

log()  { printf '%s[dubuntu]%s %s\n' "$c_blue" "$c_reset" "$*"; }
ok()   { printf '%s[dubuntu]%s %s\n' "$c_green" "$c_reset" "$*"; }
warn() { printf '%s[dubuntu]%s %s\n' "$c_yellow" "$c_reset" "$*" >&2; }
die()  { printf '%s[dubuntu]%s %s\n' "$c_red" "$c_reset" "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Dubuntu ISO builder (live-build)

Usage: sudo ./scripts/build.sh [options]

Options:
  --install-deps   Install the live-build toolchain with apt-get first
  --clean          Run `lb clean --purge` and delete build/out before building
  --no-keep        Remove the live-build work tree when the build succeeds
  --dry-run        Print the commands instead of running them (no root needed)
  -h, --help       Show this help

Environment:
  DUBUNTU_VERSION        24.04             release number
  DUBUNTU_CODENAME       "Dub Jam"         release codename
  DUBUNTU_DISTRIBUTION   noble             Ubuntu suite to bootstrap
  DUBUNTU_ARCH           amd64             amd64 | arm64 (cross-build needs qemu)
  DUBUNTU_MIRROR         http://archive.ubuntu.com/ubuntu/
  DUBUNTU_SECURITY_MIRROR http://security.ubuntu.com/ubuntu/
  DUBUNTU_ISO_NAME       dubuntu-<ver>-<arch>.iso

Files:
  auto/config                 live-build configuration
  config/package-lists/       packages baked into the image
  config/hooks/normal/        branding + cleanup hooks (run inside the chroot)
  config/includes.chroot/     files copied into the image

Output:
  build/out/dubuntu-<ver>-<arch>.iso (+ .sha256, SHA256SUMS)
  build/build.log
EOF
}

on_error() {
  local exit_code=$?
  printf '\n%s[dubuntu]%s Build failed (exit %s).\n' "$c_red" "$c_reset" "$exit_code" >&2
  printf '  Last 40 log lines (%s):\n\n' "$LOG_FILE" >&2
  tail -n 40 "$LOG_FILE" 2>/dev/null >&2 || true
  cat >&2 <<EOF

  Common causes
  -------------
  * Not running as root ............ re-run with sudo
  * Mirror unreachable ............. try DUBUNTU_MIRROR=https://<mirror>/ubuntu/
  * Disk space ..................... a desktop ISO build needs ~15-20 GB free
  * Leftover build tree ............ sudo ./scripts/build.sh --clean
  * Debian/other host .............. use scripts/build-in-docker.sh instead
EOF
  exit "$exit_code"
}
trap on_error ERR

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '  + (cd %s && %s)\n' "${RUN_CWD:-$ROOT_DIR}" "$*"
    return 0
  fi
  ( cd "${RUN_CWD:-$ROOT_DIR}" && "$@" )
}

# ------------------------------------------------------------------ parse --
while [ $# -gt 0 ]; do
  case "$1" in
    --install-deps) INSTALL_DEPS=1 ;;
    --clean)        CLEAN=1 ;;
    --no-keep)      KEEP_WORK=0 ;;
    --dry-run)      DRY_RUN=1 ;;
    -h|--help)      usage; exit 0 ;;
    *)              usage; die "Unknown option: $1" ;;
  esac
  shift
done

export DUBUNTU_VERSION DUBUNTU_CODENAME DUBUNTU_DISTRIBUTION DUBUNTU_ARCH
export DUBUNTU_MIRROR DUBUNTU_SECURITY_MIRROR DUBUNTU_ISO_NAME

# -------------------------------------------------------------- preflight --
if [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  die "live-build needs root (chroot + mount). Re-run with: sudo $0 ${ORIG_ARGS}"
fi

if [ "$DRY_RUN" -eq 0 ] && ! command -v lsb_release >/dev/null 2>&1; then
  warn "lsb_release not found — skipping host detection"
elif [ "$DRY_RUN" -eq 0 ]; then
  host_distro="$(lsb_release -is 2>/dev/null || echo unknown)"
  if [ "$host_distro" != "Ubuntu" ]; then
    warn "Host is ${host_distro}, not Ubuntu. live-build often fails off-distro."
    warn "Prefer: ./scripts/build-in-docker.sh"
  fi
fi

if [ "$INSTALL_DEPS" -eq 1 ]; then
  log "Installing build dependencies: ${DEB_PACKAGES[*]}"
  run env DEBIAN_FRONTEND=noninteractive apt-get update
  run env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${DEB_PACKAGES[@]}"
fi

missing=()
[ "$DRY_RUN" -eq 1 ] || {
  command -v lb            >/dev/null 2>&1 || missing+=(live-build)
  command -v debootstrap   >/dev/null 2>&1 || missing+=(debootstrap)
  command -v mksquashfs    >/dev/null 2>&1 || missing+=(squashfs-tools)
  command -v xorriso       >/dev/null 2>&1 || missing+=(xorriso)
  command -v mcopy         >/dev/null 2>&1 || missing+=(mtools)
  command -v mkfs.vfat     >/dev/null 2>&1 || missing+=(dosfstools)
  [ -e /usr/lib/ISOLINUX/isohdpfx.bin ] || missing+=(isolinux)
  [ -e /usr/lib/grub/i386-pc ]          || missing+=(grub-pc-bin)
  [ -e /usr/lib/grub/x86_64-efi ]       || missing+=(grub-efi-amd64-bin)
}

if [ "${#missing[@]}" -gt 0 ]; then
  die "Missing build dependencies: ${missing[*]}
  Install them with: sudo $0 --install-deps"
fi

# ------------------------------------------------------------------ build --
log "Dubuntu ${DUBUNTU_VERSION} LTS (${DUBUNTU_CODENAME}) — ${DUBUNTU_ARCH}"
log "Suite: ${DUBUNTU_DISTRIBUTION}   Mirror: ${DUBUNTU_MIRROR}"
log "Build tree: ${WORK_DIR}"

if [ "$CLEAN" -eq 1 ]; then
  log "Cleaning previous build"
  if [ -d "$WORK_DIR" ]; then
    RUN_CWD="$WORK_DIR" run lb clean --purge || true
  fi
  run rm -rf "$WORK_DIR" "$OUT_DIR"
fi

mkdir -p "$OUT_DIR"

# live-build insists on owning its working directory; keep the website and
# git tree out of it by staging auto/ + config/ into build/lb/.
if [ "$DRY_RUN" -eq 0 ]; then
  mkdir -p "$WORK_DIR"
  rsync -a --delete "${ROOT_DIR}/auto/"   "${WORK_DIR}/auto/"
  rsync -a --delete "${ROOT_DIR}/config/" "${WORK_DIR}/config/"
  chmod +x "${WORK_DIR}/auto/config" "${WORK_DIR}"/config/hooks/normal/*.hook.chroot 2>/dev/null || true
  : > "$LOG_FILE"
fi

if [ "$DRY_RUN" -eq 0 ] && [ ! -x "${WORK_DIR}/config/hooks/normal/0100-dubuntu-branding.hook.chroot" ]; then
  die "Branding hook is missing or not executable in config/hooks/normal/"
fi

if [ "$DRY_RUN" -eq 0 ]; then
  log "live-build: $(lb --version 2>/dev/null | head -n1 || echo unknown)"
fi

log "Configuring live-build (auto/config)"
RUN_CWD="$WORK_DIR" run lb config

log "Building the image — this takes 20-60 minutes and several GB of disk"
if [ "$DRY_RUN" -eq 1 ]; then
  RUN_CWD="$WORK_DIR" run lb build
else
  set +e
  RUN_CWD="$WORK_DIR" lb build 2>&1 | tee -a "$LOG_FILE" | \
    grep --line-buffered -E '^(P|I|E|W):|^Get:|^Setting up|squashfs|Creating .*iso|Generating'
  build_status="${PIPESTATUS[0]}"
  set -e
  if [ "$build_status" -ne 0 ]; then
    die "lb build failed (exit ${build_status}) — see ${LOG_FILE}"
  fi
fi

# ----------------------------------------------------------------- publish --
shopt -s nullglob
built=()
for candidate in \
  "${WORK_DIR}/live-image-${DUBUNTU_ARCH}.hybrid.iso" \
  "${WORK_DIR}"/*.hybrid.iso \
  "${WORK_DIR}"/*.iso; do
  if [ -f "$candidate" ]; then
    built+=("$candidate")
  fi
done

if [ "$DRY_RUN" -eq 1 ]; then
  log "Dry run complete — nothing was built"
  exit 0
fi

if [ "${#built[@]}" -eq 0 ]; then
  die "No ISO produced in ${WORK_DIR}"
fi

iso_src="${built[0]}"
iso_dest="${OUT_DIR}/${DUBUNTU_ISO_NAME}"

log "Publishing $(basename "$iso_src") -> ${iso_dest}"
mv -f "$iso_src" "$iso_dest"

log "Writing checksums"
( cd "$OUT_DIR" && sha256sum "$DUBUNTU_ISO_NAME" > "${DUBUNTU_ISO_NAME}.sha256" )
( cd "$OUT_DIR" && sha256sum *.iso > SHA256SUMS )

if [ "$KEEP_WORK" -eq 0 ]; then
  log "Removing build tree (--no-keep)"
  rm -rf "$WORK_DIR"
fi

iso_size="$(du -h "$iso_dest" | cut -f1)"
iso_sha="$(cut -d' ' -f1 "${OUT_DIR}/${DUBUNTU_ISO_NAME}.sha256")"

cat <<EOF

  ${c_green}${c_bold}Dubuntu ISO ready${c_reset}
  ------------------------------------------
  File    ${iso_dest}
  Size    ${iso_size}
  SHA256  ${iso_sha}
  Log     ${LOG_FILE}

  Write it to a USB stick (replace /dev/sdX!):
    sudo dd if=${iso_dest} of=/dev/sdX bs=4M status=progress conv=fsync
  Or try it in a VM:
    qemu-system-x86_64 -enable-kvm -m 4096 -cdrom ${iso_dest} -boot d

EOF
