# ChessView production guard (KVM8)

Replaces `.github/workflows/production-guard.yml` since 25 Nov 2026 (Kingdom deploy standard, `C:\Kingdom\DEPLOY.md`).
The same checks and the same ownership rule, now run by the server every 15 minutes instead of GitHub Actions.

- `hoc-chessview-guard`: the guard (Python 3.12 stdlib, root). Its top docstring is the exact rule.
- `hoc-chessview-guard.service` / `.timer`: one run every 15 minutes (`OnCalendar=*:0/15`).
- `install.sh`: idempotent install; the first run also makes the guard's own GitHub key
  (`/etc/hoc-secrets/chessview/production-guard-github`, root only) and prints its public key, which is added on this
  repository as a deploy key with write access (it only ever pushes `Revert growth release ...` commits).

Install or update from Windows (Git Bash), from this repository's root, after committing (the archive keeps LF endings):

```bash
git -c core.autocrlf=false archive --format=tar HEAD:ops/production-guard | /c/Windows/System32/OpenSSH/ssh.exe -T -o BatchMode=yes hoc-kvm8-direccion \
  'd=$(mktemp -d) && tar -xf - -C "$d" && sudo -n bash "$d/install.sh" "$d"'
```

Read it on KVM8: `sudo cat /var/lib/hoc-chessview-guard/last.json`, `history.jsonl` (incidents and actions only),
`journalctl -u hoc-chessview-guard`. Run once now: `sudo systemctl start hoc-chessview-guard`.

Releases themselves are kingdom-deploy's (`kingdom-deploy.json` at the root; app `chessview-web`), which already
restores the previous release when a new one fails its checks. Changing this folder does not rebuild the site.
