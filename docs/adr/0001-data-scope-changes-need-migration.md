# 0001: Changing data scope needs an explicit migration path

Status: accepted
Date: 2026-11-15

## Decision

Do not move data between scopes (for example guild- or channel-scoped records
to bot-wide records) without a written migration path. Do not delete old
records unless the user explicitly approves it.

Migrations:

- keep the old rows as backups;
- never silently overwrite or delete scoped records with defaults;
- are idempotent: re-running one yields the same global result;
- define duplicate precedence before coding, and keep the existing global
  record unless the user names another rule;
- stay out of command and autocomplete paths, which read only the final
  storage location;
- are tested with several source records, duplicate IDs, an existing global
  record, and retained old rows.

## Why

Data lives in SQLite files on one host and a rollback cannot undo a migration.
A scope change that overwrites or drops rows is the one mistake that cannot be
reverted by redeploying an earlier image.

## Revisit if

- backups are automated and a restore has been tested, so old rows no longer
  need to stay in the live database;
- data moves to a store with point-in-time recovery.
