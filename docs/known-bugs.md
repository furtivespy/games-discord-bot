# Known Bugs

This doc tracks bugs found during manual testing. These are open/untriaged and are **unrelated** to the in-flight defer-reply optimization rollout work currently in progress in `subcommands/cards/*.js`. No fixes are included here — tracking only.

## 1. `/cards pile create` leaves the original interaction stuck on "thinking..."

`/cards pile create` doesn't edit the original deferred interaction reply. Instead, it ends up creating a brand new message, so the original interaction is never resolved and stays stuck showing "thinking..." to the user indefinitely.

**Likely file:** `subcommands/cards/pilecreate.js`

**Root cause observed:** `pilecreate.js` correctly calls `interaction.deferReply()` up front and uses `interaction.editReply()` for its early-exit error paths (no game, duplicate pile name). However, the success path calls `GameStatusHelper.sendPublicStatusUpdate(interaction, client, gameData, {...})`, and that helper (`modules/GameStatusHelper.js`) unconditionally sends the status update via `channel.send({ ...fullReply, fetchReply: true })` — it never calls `interaction.editReply()`. So on success, the deferred reply is never resolved and is left hanging while a separate new message is posted to the channel. (Contrast with the sibling `sendGameStatus` helper in the same file, which correctly branches on `interaction.deferred || interaction.replied` to call `editReply`/`reply`.)

Status: Open

## 2. `/cards pile peek` sends both messages as ephemeral (main reply should be public)

`/cards pile peek` sends both of its messages — the main reply and the follow-up — as ephemeral. The first/main reply should be public (not ephemeral).

**Likely file:** `subcommands/cards/pilepeek.js`

**Root cause observed:** The initial `interaction.deferReply(...)` is called with `flags: MessageFlags.Ephemeral`, so the main reply (later resolved via `interaction.editReply()`) is ephemeral from the start. The subsequent `interaction.followUp({ ... flags: MessageFlags.Ephemeral })` is also explicitly ephemeral. Both sends need the ephemeral flag reconsidered — at minimum the initial `deferReply` should not be ephemeral for the main/public reply.

Status: Open

## 3. Image-rendering failures cause the whole command to fail with no response

An image-rendering error was observed in a Honeycomb trace (trace ID: `125fb5b201943de918544a5712d6cd7f` — kept here for reference/lookup by whoever investigates) that caused the whole command to fail out entirely instead of degrading gracefully. This is a general resilience gap rather than a single-file bug — it likely spans `modules/GameFormatter.js` (where card/image rendering happens) and the various subcommand handlers that call into it.

**Desired behavior:** If card/image rendering fails partway through, the handler should catch that failure and still send a best-effort reply to the user (e.g. text-only content or partial embeds without the failed image) rather than letting the error propagate and leaving the interaction with no response at all.

**Note:** The exact trace/command was not identified as part of this write-up (no Honeycomb access available) — this entry just records the trace ID and the desired resilience behavior for later investigation.

Status: Open
