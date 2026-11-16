## Intent

<!-- What this changes and why, in a few sentences. -->

## Linear

<!-- e.g. FUR-123 -->

## Door

<!-- two-way (easy to revert) | one-way (data, contracts, releases) -->

## Testing

<!-- Commands run and their results. Say what you could not verify. -->

## QA Status

<!-- Maintained by the QA agent: rewrite everything between the markers after every QA pass. A verdict is only valid while Head equals the PR's current head SHA. See docs/merge-policy.md. -->
<!-- qa-status:start -->
- **Verdict:** pending
- **Head:** -
- **Verified:** -
- **For you to test:** none
- **User call-out:** none
<!-- qa-status:end -->

## Checklist

- [ ] New user-facing slash commands (and new `/cards` / `/game` / … subcommands) get a one-line `/help` entry: they load from `slashcommands/` automatically; add a `COMMAND_BLURBS` line in `modules/helpCatalog.js` when the slash description is too terse, and set `permLevel` to `Bot Owner` or `Administrator` so help can label them.
- [ ] Tests added or updated for the behavior change
- [ ] PR has exactly one of: `major` | `minor` | `patch` (release tag workflow)
