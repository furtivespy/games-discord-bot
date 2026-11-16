# Rollback

Status: written from the workflows, **not yet rehearsed**. Do one dry run
before relying on it.

## How production gets a version

`release.yml` runs on every merged PR. It tags the merge `vX.Y.Z`, builds the
image once, and pushes `gitea.willsullivan.dev/furtivespy/game-bot:vX.Y.Z` and
`:latest`. The host checks for a new `latest` about every 5 minutes and
restarts on it. `GET https://gamebot.willsullivan.dev/health` reports the commit
that is running.

## Roll back a bad release

Pick one.

**A. Revert (normal path, about 10 minutes).** Revert the PR on `master`
through a normal PR. The release workflow builds a new `latest`; the host picks
it up. Use this when the bad change is understood.

**B. Re-point `latest` (fastest).** Retag the last good image as `latest`:

```sh
IMAGE=gitea.willsullivan.dev/furtivespy/game-bot
docker pull $IMAGE:vX.Y.Z      # last good tag
docker tag  $IMAGE:vX.Y.Z $IMAGE:latest
docker push $IMAGE:latest
```

Then follow up with option A so `master` matches what is running; otherwise
the next merge ships the bad change again.

## Confirm it worked

```sh
EXPECTED_SHA=<commit of the good release> node scripts/check-deployed-version.js
```

Images built before the `/health` endpoint shipped do not report a SHA, so a
rollback past that point cannot be confirmed this way; check the bot in
Discord instead.

## What rollback does not undo

Data. A migration is not reversed by running older code. Migrations keep the old
rows as backups ([ADR 0001](../adr/0001-data-scope-changes-need-migration.md));
restore from those, not from the image.

## Not covered yet

Backups and a tested restore are out of scope for now. See rung 9 in the
autopilot audit notes in the PR that added this file.
