const { PermissionsBitField } = require("discord.js");

const ENV_NAME = "QA_UNLOCK_ADMIN_COMMANDS";
const TRUTHY = new Set(["1", "true", "yes", "on"]);

function isQaUnlockAdminCommands(env = process.env) {
  const raw = env[ENV_NAME];
  if (raw == null) return false;
  return TRUTHY.has(String(raw).trim().toLowerCase());
}

function applyAdminDefaultMemberPermissions(builder, env = process.env) {
  if (!isQaUnlockAdminCommands(env)) {
    builder.setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
  }
  return builder;
}

function memberHasAdministrator(interaction, env = process.env) {
  if (isQaUnlockAdminCommands(env)) return true;
  return Boolean(
    interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)
  );
}

function stripAdministratorDefaultMemberPermissions(commandJson, env = process.env) {
  if (!isQaUnlockAdminCommands(env) || !commandJson) return commandJson;
  const perms = commandJson.default_member_permissions;
  if (perms == null || perms === "0") return commandJson;

  try {
    const bits = new PermissionsBitField(perms);
    if (!bits.has(PermissionsBitField.Flags.Administrator)) return commandJson;
    bits.remove(PermissionsBitField.Flags.Administrator);
    commandJson.default_member_permissions = bits.bitfield
      ? bits.bitfield.toString()
      : null;
  } catch {
    return commandJson;
  }
  return commandJson;
}

function slashCommandJsonForRegistration(command, env = process.env) {
  const json =
    typeof command?.data?.toJSON === "function" ? command.data.toJSON() : command;
  return stripAdministratorDefaultMemberPermissions(json, env);
}

module.exports = {
  ENV_NAME,
  isQaUnlockAdminCommands,
  applyAdminDefaultMemberPermissions,
  memberHasAdministrator,
  stripAdministratorDefaultMemberPermissions,
  slashCommandJsonForRegistration,
};
