---
name: ship-pr
description:
  Shepherd a pull request in this repo to merged or parked. Use when a PR is
  ready to finish, or when asked to merge, babysit, or "ship" one.
---

# Ship PR

Policy lives in [docs/merge-policy.md](../../../docs/merge-policy.md); the
decisions live in `.github/ship-pr.json`. This skill only runs the loop.

1. **Fill the PR template**: Intent, Linear issue, Door, Testing. Run
   `bun run verify` and cite the result under Testing.
2. **QA pass.** The QA agent rewrites the block between
   `<!-- qa-status:start -->` and `<!-- qa-status:end -->` in the PR
   description: `Verdict`, `Head` (full head SHA it reviewed), `Verified`,
   `For you to test`, `User call-out`. It must rewrite the block after every new
   commit.
3. **Pick the risk tier** from [docs/merge-policy.md](../../../docs/merge-policy.md)
   (`low`, `medium`, `high`). A `User call-out` that is not `none` makes it high.
4. **Gather state and ask for the next step:**

   ```sh
   gh pr view <n> --json number,url,state,isDraft,mergeable,mergeStateStatus,headRefOid,statusCheckRollup,reviewDecision,body
   npx kcd-skills@latest autopilot ship-pr --input state.json --risk <tier> --json
   ```

   `npx kcd-skills@latest autopilot ship-pr --schema` prints the state format.
   Map checks to `{name, status}` (use the check names, for example `test`
   and `lint`), and set `headSha` to `headRefOid`.

   The Cursor QA run is a comment, not a GitHub review, so add
   `{"login": "cursor", "state": "COMMENTED"}` to `reviews` **only when all
   three hold**: `Verdict: PASS`, `Head` equals the current `headRefOid`, and
   `For you to test` is `none`. Otherwise leave `reviews` empty and the loop
   returns `wait-for-review`.
5. **Do the one action it returns**: fix CI, address review threads (fix it, or
   reply with why), resolve conflicts, mark ready, wait, or merge. Reviewers
   check every changed test expectation against the intent. Then repeat step 4
   with fresh state.
6. **Merge** only when the step is `merge`, using a merge commit
   (`gh pr merge <n> --merge`). `high` risk always parks for the owner.
7. **After merge**, `release.yml` builds the image and its `verify-deploy` job
   waits for `/health` to report the merge commit. To check by hand:
   `SHIP_PR_SHA=<merge-sha> node scripts/check-deployed-version.js`.
8. **Leftovers and friction:** file follow-ups as Linear issues in the Game Bot
   project, with a priority; add the `needs-decision` label when the owner must
   decide. If the PR cost you time because of the repo itself (a flaky check, a
   wrong doc, a missing fixture), file it by following
   [friction-log](../friction-log/SKILL.md). Nothing met the bar? File nothing.
