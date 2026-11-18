"use strict";

/**
 * Serialize load → mutate → save for one game document. Slash `/cards hand
 * play|discard|show` and visual Activity actions share this queue so they
 * cannot last-write-wins against each other. Channel posts stay off this
 * lock: a hung Discord send or pin REST must not stall the next persist.
 */
function createGameChannelLock() {
  const tails = new Map();

  function run(guildId, channelId, fn) {
    const key = `${guildId}:${channelId}`;
    const previous = tails.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(fn);
    const idle = next.then(
      () => {},
      () => {}
    );
    tails.set(key, idle);
    idle.then(() => {
      if (tails.get(key) === idle) tails.delete(key);
    });
    return next;
  }

  return { run };
}

const defaultGameChannelLock = createGameChannelLock();

function withGameDocumentLock(guildId, channelId, fn) {
  return defaultGameChannelLock.run(String(guildId || ""), String(channelId || ""), fn);
}

module.exports = {
  createGameChannelLock,
  defaultGameChannelLock,
  withGameDocumentLock,
};
