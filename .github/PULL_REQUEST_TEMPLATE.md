## Summary

<!-- What does this PR do, and why? -->

## Linear

<!-- e.g. FUR-123 -->

## Checklist

- [ ] New user-facing slash commands (and new `/cards` / `/game` / … subcommands) get a one-line `/help` entry: they load from `slashcommands/` automatically; add a `COMMAND_BLURBS` line in `modules/helpCatalog.js` when the slash description is too terse, and set `permLevel` to `Bot Owner` or `Administrator` so help can label them.
- [ ] Tests added or updated for the behavior change
- [ ] PR has exactly one of: `major` | `minor` | `patch` (release tag workflow)

## Manual test (if user-facing)

<!-- Live Game Bot server steps, if this ships a command or message users will see. -->
