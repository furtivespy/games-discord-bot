# Agent Guidance

## Data migrations

- Do not change data scope (for example, guild- or channel-scoped data to bot-wide data) without an explicit migration path.
- Preserve old records as backups unless deletion is explicitly approved.
- Migration defaults must not silently overwrite or delete scoped records.
- Make consolidation idempotent: re-running it should produce the same global result.
- Define duplicate precedence before coding. Preserve the existing global record unless the user specifies another rule.
- Keep migration work out of normal command and autocomplete paths. Commands should read only their final storage location.
- Test migrations with multiple source records, duplicate IDs, an existing global record, and retained old rows.

## Pull request scope

- Do not add product behavior beyond an approved design without first getting confirmation.
- Keep required storage migrations separate from optional UX or behavior changes, such as duplicate-submit behavior, vote merging, or DM support.
