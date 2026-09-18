const { ApplicationCommandType, Collection } = require("discord.js");

const PRIMARY_ENTRY_POINT_TYPE = ApplicationCommandType.PrimaryEntryPoint ?? 4;
const DISCORD_LAUNCH_ACTIVITY = 2;

function slashCommandJson(slashcommands) {
  const list =
    slashcommands instanceof Collection
      ? [...slashcommands.values()]
      : Array.isArray(slashcommands)
        ? slashcommands
        : [];
  return list.map((command) => command.data.toJSON());
}

function primaryEntryPointCommand() {
  return {
    name: "launch",
    type: PRIMARY_ENTRY_POINT_TYPE,
    handler: DISCORD_LAUNCH_ACTIVITY,
  };
}

function buildApplicationCommandPayload(slashcommands) {
  return [...slashCommandJson(slashcommands), primaryEntryPointCommand()];
}

function logError(logger, error) {
  if (typeof logger?.error === "function") {
    logger.error(error);
    return;
  }
  logger?.log(error, "error");
}

async function putApplicationCommands({ rest, route, slashcommands, logger }) {
  const withLaunch = buildApplicationCommandPayload(slashcommands);
  try {
    await rest.put(route, { body: withLaunch });
    logger?.log("Successfully registered application commands.");
    return { usedLaunchEntryPoint: true };
  } catch (error) {
    logger?.log(
      "Registering commands with Activity Launch entry point failed; retrying without it.",
      "warn"
    );
    logError(logger, error);
  }

  await rest.put(route, { body: slashCommandJson(slashcommands) });
  logger?.log(
    "Successfully registered application commands without Launch entry point."
  );
  return { usedLaunchEntryPoint: false };
}

module.exports = {
  DISCORD_LAUNCH_ACTIVITY,
  PRIMARY_ENTRY_POINT_TYPE,
  buildApplicationCommandPayload,
  primaryEntryPointCommand,
  putApplicationCommands,
  slashCommandJson,
};
