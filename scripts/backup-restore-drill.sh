#!/usr/bin/env sh
set -eu

if [ -z "${SOURCE_DATABASE_URL:-}" ] || [ -z "${RESTORE_DATABASE_URL:-}" ]; then
  echo "SOURCE_DATABASE_URL and RESTORE_DATABASE_URL are required" >&2
  exit 1
fi
if [ "${SOURCE_DATABASE_URL}" = "${RESTORE_DATABASE_URL}" ]; then
  echo "Source and restore databases must be different" >&2
  exit 1
fi
if [ "${BACKUP_RESTORE_CONFIRM:-}" != "restore-target-may-be-overwritten" ]; then
  echo "Set BACKUP_RESTORE_CONFIRM=restore-target-may-be-overwritten after verifying the restore target" >&2
  exit 1
fi

drill_tmp_dir="$(mktemp -d)"
trap 'rm -rf "${drill_tmp_dir}"' EXIT
backup_file="${drill_tmp_dir}/database.dump"

pg_dump --dbname="${SOURCE_DATABASE_URL}" --format=custom --no-owner --no-acl --file="${backup_file}"
pg_restore --dbname="${RESTORE_DATABASE_URL}" --clean --if-exists --no-owner --no-acl --exit-on-error "${backup_file}"

source_migrations="$(psql "${SOURCE_DATABASE_URL}" -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"
restore_migrations="$(psql "${RESTORE_DATABASE_URL}" -Atc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL')"
source_users="$(psql "${SOURCE_DATABASE_URL}" -Atc 'SELECT count(*) FROM users')"
restore_users="$(psql "${RESTORE_DATABASE_URL}" -Atc 'SELECT count(*) FROM users')"

if [ "${source_migrations}" != "${restore_migrations}" ] || [ "${source_users}" != "${restore_users}" ]; then
  echo "Restore verification failed: migration/user counts differ" >&2
  exit 1
fi

echo "Backup/restore drill passed: migrations=${restore_migrations}, users=${restore_users}"
