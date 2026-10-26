#!/bin/sh
set -eu
backup_once() {
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  destination="/backups/$stamp"
  mkdir -p "$destination"
  pg_dump --format=custom --no-owner --file="$destination/database.dump.partial"
  pg_restore --list "$destination/database.dump.partial" > /dev/null
  mv "$destination/database.dump.partial" "$destination/database.dump"
  tar -czf "$destination/uploads.tar.gz" -C /uploads .
  touch /backups/last-success
  find /backups -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +15 | while IFS= read -r old; do
    case "$old" in /backups/20*) rm -rf -- "$old" ;; *) exit 1 ;; esac
  done
  echo "PostgreSQL and upload backup completed: $stamp"
}
if [ "${1:-}" = "--once" ]; then backup_once; exit 0; fi
while true; do
  if ! (backup_once); then echo "Backup failed; retrying in one hour" >&2; sleep 3600; continue; fi
  sleep 86400
done
