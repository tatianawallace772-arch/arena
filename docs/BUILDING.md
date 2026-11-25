# Building the Dubuntu ISO

Dubuntu ships as a **live-build** image: Ubuntu 24.04 LTS (`noble`) packages, a
GNOME desktop, and Dubuntu branding applied inside the chroot. One command builds
a hybrid BIOS + UEFI ISO.

```bash
sudo apt update
sudo apt install -y live-build debootstrap squashfs-tools xorriso isolinux \
  grub-pc-bin grub-efi-amd64-bin grub-efi-amd64-signed shim-signed mtools dosfstools
sudo ./scripts/build.sh
# Output: build/out/dubuntu-24.04-amd64.iso
```

`./scripts/build.sh --install-deps` runs that apt line for you.

---

## 1. Requirements

| Item | Minimum | Notes |
|------|---------|-------|
| Host OS | Ubuntu 24.04 LTS (noble) | live-build is only reliable on its target distro. Off-distro? Use Docker (§2). |
| Privileges | root | `chroot`, bind mounts and loop devices are required. |
| Disk | 20 GB free | chroot (~4 GB) + squashfs (~2 GB) + ISO (~5 GB) + cache. |
| RAM | 4 GB | 8 GB recommended for the desktop build. |
| Network | ~5 GB download | Bootstrap + packages from the Ubuntu archive. |

The build tree is staged into `build/lb/`, so your website files and git index
are never touched. Everything live-build produces stays under `build/`.

## 2. Building with Docker (any host)

If you are not on Ubuntu 24.04 — Debian, Fedora, macOS, or CI — use the
container path. It uses `ubuntu:24.04` with the full toolchain preinstalled.

```bash
./scripts/build-in-docker.sh              # build
./scripts/build-in-docker.sh --clean      # purge and rebuild
```

Requirements: Docker with privileged container support (loop devices are
mandatory for live-build). The repo is bind-mounted at `/build`, so the ISO
still appears in `build/out/` on your machine.

## 3. What `build.sh` does

1. Checks root, host distro, and every tool/bootloader file live-build needs.
2. Stages `auto/` and `config/` into `build/lb/`.
3. Runs `lb config` — which executes [`auto/config`](../auto/config) — then `lb build`.
4. Moves the resulting `*.hybrid.iso` to `build/out/dubuntu-<ver>-<arch>.iso`.
5. Writes `…iso.sha256` and a combined `SHA256SUMS`, then prints size and hash.

Progress is streamed and simultaneously written to `build/build.log`. On failure
the last 40 lines of that log plus a short troubleshooting list are printed.

### Options

| Flag | Effect |
|------|--------|
| `--install-deps` | `apt-get install` the live-build toolchain first |
| `--clean` | `lb clean --purge`, delete `build/lb` and `build/out`, then rebuild |
| `--no-keep` | Delete the ~10 GB work tree after a successful build |
| `--dry-run` | Print the commands without running them (no root needed) |
| `-h`, `--help` | Usage |

### Environment overrides

| Variable | Default | Purpose |
|----------|---------|---------|
| `DUBUNTU_VERSION` | `24.04` | Version string baked into `/etc/os-release` |
| `DUBUNTU_CODENAME` | `Dub Jam` | Codename shown in `PRETTY_NAME`, `motd` |
| `DUBUNTU_DISTRIBUTION` | `noble` | Ubuntu suite bootstrapped (must exist in the archive) |
| `DUBUNTU_ARCH` | `amd64` | `arm64` needs a matching host or qemu binfmt |
| `DUBUNTU_MIRROR` | `http://archive.ubuntu.com/ubuntu/` | Bootstrap + chroot mirror |
| `DUBUNTU_SECURITY_MIRROR` | `http://security.ubuntu.com/ubuntu/` | Security pocket |
| `DUBUNTU_ISO_NAME` | `dubuntu-<ver>-<arch>.iso` | Output filename |

Example — build against a faster regional mirror:

```bash
sudo DUBUNTU_MIRROR=http://ftp.osuosl.org/pub/ubuntu/ ./scripts/build.sh --clean
```

## 4. Customising the image

| Want to change… | Edit |
|-----------------|------|
| Installed packages | [`config/package-lists/dubuntu.list.chroot`](../config/package-lists/dubuntu.list.chroot) |
| Name, version, `/etc/os-release`, motd, wallpaper, GNOME defaults | [`config/hooks/normal/0100-dubuntu-branding.hook.chroot`](../config/hooks/normal/0100-dubuntu-branding.hook.chroot) |
| Cache trimming, machine-id reset | [`config/hooks/normal/0200-dubuntu-cleanup.hook.chroot`](../config/hooks/normal/0200-dubuntu-cleanup.hook.chroot) |
| Files copied verbatim into the image | `config/includes.chroot/` (paths are absolute from `/`) |
| Files copied onto the ISO itself (not the squashfs) | `config/includes.binary/` |
| Bootloader args, ISO volume label, archive areas | [`auto/config`](../auto/config) |
| Live-session boot parameters (`username=dubuntu`, `quiet splash`) | `--bootappend-live` in `auto/config` |

Hooks must stay executable (`chmod +x`); the build script re-applies the bit,
but git mode changes are what actually travel to CI.

### Version naming

`DUBUNTU_VERSION` is a **branding string**. Real packages always come from
`DUBUNTU_DISTRIBUTION`. If the marketing site says *26.04 LTS “Dub Jam”* but the
archive you can actually bootstrap is `noble`, either:

* keep `DUBUNTU_DISTRIBUTION=noble` and set `DUBUNTU_VERSION=26.04` (image claims
  26.04 while carrying noble packages), or
* keep both at `24.04` / `noble` for an honest build.

## 5. Testing the ISO

```bash
# Boot in a VM (KVM recommended)
qemu-system-x86_64 -enable-kvm -m 4096 -smp 2 -cdrom build/out/dubuntu-24.04-amd64.iso -boot d

# Or with VirtualBox / VMware / UTM, attach the ISO as an optical drive
```

Check, inside the live session:

```bash
cat /etc/os-release      # PRETTY_NAME="Dubuntu 24.04 LTS (Dub Jam)"
cat /etc/motd            # Dubuntu banner
hostname                 # dubuntu
```

## 6. Writing to USB

```bash
lsblk                                  # find the stick, e.g. /dev/sdb — NOT your disk
sudo dd if=build/out/dubuntu-24.04-amd64.iso of=/dev/sdb bs=4M status=progress conv=fsync
sync
```

Balena Etcher or `usb-creator-gtk` work too. The ISO is hybrid, so it boots from
USB on BIOS and UEFI machines.

## 7. Verifying

```bash
cd build/out
sha256sum -c dubuntu-24.04-amd64.iso.sha256
grep dubuntu-24.04-amd64.iso SHA256SUMS
```

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `live-build needs root` | Re-run with `sudo`. |
| `Missing build dependencies: …` | `sudo ./scripts/build.sh --install-deps` |
| `E: Failed getting release file` / 404 on a package | Wrong suite or stale mirror. Try `DUBUNTU_MIRROR=https://…` and `--clean`. |
| `mount: permission denied` / loop device errors in Docker | The container must be `--privileged`; on SELinux hosts add `--security-opt label=disable`. |
| Build dies with no disk left | Needs ~20 GB. `sudo ./scripts/build.sh --clean` then use `--no-keep`. |
| `lb build` fails after a config change | Stale tree: `sudo ./scripts/build.sh --clean`. |
| ISO boots to a shell, no desktop | `ubuntu-desktop-minimal` failed to install — grep `build/build.log` for `E:` package errors. |
| Host is Debian/Fedora | Use `./scripts/build-in-docker.sh`. |
| `snapd` post-install fails in the chroot | Drop `snapd` from the package list; install snaps after first boot. |
| Want Firefox, but `firefox` fails | In 24.04 the `firefox` deb is a snap shim. Keep `epiphany-browser`, then `snap install firefox` in the live session. |

## 9. Installer status

The ISO is a **live image** (BIOS + UEFI hybrid). It boots to a full desktop
session you can use, demo and rescue with.

Ubuntu 24.04's desktop installer ships as the `ubuntu-desktop-bootstrap` snap,
which live-build does not integrate, so the image intentionally ships without an
installer rather than a half-working one. To install from the live session, run
the snap (network required) or use the official Ubuntu ISO's installer against a
separate partition. Wiring in Calamares is tracked as a follow-up in
[`community.html`](../community.html) roadmap territory — contributions welcome.
