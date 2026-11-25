#!/bin/bash
# Idempotent install of the ChessView production guard on KVM8. Run as root with this folder as $1:
#   git -c core.autocrlf=false archive --format=tar HEAD:ops/production-guard | ssh hoc-kvm8-direccion 'd=$(mktemp -d) && tar -xf - -C "$d" && sudo -n bash "$d/install.sh" "$d"'
# It (re)installs the script and units, makes the guard's GitHub key once (prints only the public key; add it on
# raphaelbabilonia/chessview.org-next.js as a deploy key WITH write access: the guard pushes growth-release reverts),
# and enables the timer. Remove: systemctl disable --now hoc-chessview-guard.timer (state and key are kept).
set -euo pipefail
SRC="${1:?folder}"
[ "$(hostname)" = srv2090735 ] || { echo "KVM8 only"; exit 2; }
install -m 0700 "$SRC"/hoc-chessview-guard /usr/local/sbin/hoc-chessview-guard
install -m 0644 "$SRC"/hoc-chessview-guard.service /etc/systemd/system/hoc-chessview-guard.service
install -m 0644 "$SRC"/hoc-chessview-guard.timer /etc/systemd/system/hoc-chessview-guard.timer
install -d -m 0700 /var/lib/hoc-chessview-guard
install -d -m 0700 /etc/hoc-secrets/chessview
KEY=/etc/hoc-secrets/chessview/production-guard-github
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N '' -C 'chessview production guard srv2090735 (growth reverts)' -f "$KEY"
chmod 0600 "$KEY"
systemctl daemon-reload
systemctl enable --now hoc-chessview-guard.timer >/dev/null
echo "guard $(sha256sum /usr/local/sbin/hoc-chessview-guard | cut -c1-12) installed; timer $(systemctl is-active hoc-chessview-guard.timer)"
echo "public key: $(cat "$KEY.pub")"
case "$SRC" in /tmp/tmp.*) rm -rf -- "$SRC" ;; esac
