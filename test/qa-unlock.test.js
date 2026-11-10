const { afterEach, describe, expect, test } = require("bun:test");
const { PermissionsBitField, SlashCommandBuilder } = require("discord.js");
const {
  ENV_NAME,
  applyAdminDefaultMemberPermissions,
  isQaUnlockAdminCommands,
  memberHasAdministrator,
  slashCommandJsonForRegistration,
  stripAdministratorDefaultMemberPermissions,
} = require("../modules/qaUnlock");
const Config = require("../slashcommands/util/config");
const Settings = require("../slashcommands/util/settings");

const ADMIN = String(PermissionsBitField.Flags.Administrator);

function stubClient() {
  return { logger: { log() {} }, config: { botOwnerId: "owner-1" } };
}

function restoreUnlockEnv(previous) {
  if (previous === undefined) delete process.env[ENV_NAME];
  else process.env[ENV_NAME] = previous;
}

describe("isQaUnlockAdminCommands", () => {
  test("is unset by default", () => {
    expect(isQaUnlockAdminCommands({})).toBe(false);
    expect(isQaUnlockAdminCommands({ [ENV_NAME]: undefined })).toBe(false);
  });

  test("treats 1 / true / yes / on as set (truthy)", () => {
    for (const value of ["1", "true", "TRUE", " yes ", "On"]) {
      expect(isQaUnlockAdminCommands({ [ENV_NAME]: value })).toBe(true);
    }
  });

  test("treats empty, 0, false, no, and off as unset", () => {
    for (const value of ["", "0", "false", "no", "off", "  "]) {
      expect(isQaUnlockAdminCommands({ [ENV_NAME]: value })).toBe(false);
    }
  });
});

describe("admin defaultMemberPermissions", () => {
  test("unset keeps the Administrator gate", () => {
    const json = applyAdminDefaultMemberPermissions(
      new SlashCommandBuilder().setName("config").setDescription("cfg"),
      {}
    ).toJSON();
    expect(json.default_member_permissions).toBe(ADMIN);
  });

  test("set omits the Administrator gate", () => {
    const json = applyAdminDefaultMemberPermissions(
      new SlashCommandBuilder().setName("config").setDescription("cfg"),
      { [ENV_NAME]: "1" }
    ).toJSON();
    expect(json.default_member_permissions == null).toBe(true);
  });
});

describe("memberHasAdministrator", () => {
  test("unset requires the Discord Administrator bit", () => {
    expect(
      memberHasAdministrator({ memberPermissions: { has: () => false } }, {})
    ).toBe(false);
    expect(
      memberHasAdministrator(
        {
          memberPermissions: {
            has: (flag) => flag === PermissionsBitField.Flags.Administrator,
          },
        },
        {}
      )
    ).toBe(true);
  });

  test("set skips the runtime administrator check", () => {
    expect(
      memberHasAdministrator({ memberPermissions: { has: () => false } }, {
        [ENV_NAME]: "1",
      })
    ).toBe(true);
  });
});

describe("slashCommandJsonForRegistration", () => {
  test("strips Administrator from already-built command JSON when set", () => {
    const command = {
      data: {
        toJSON: () => ({
          name: "config",
          default_member_permissions: ADMIN,
        }),
      },
    };
    const locked = slashCommandJsonForRegistration(command, {});
    expect(locked.default_member_permissions).toBe(ADMIN);

    const unlocked = slashCommandJsonForRegistration(command, {
      [ENV_NAME]: "1",
    });
    expect(unlocked.default_member_permissions).toBeNull();
  });

  test("leaves non-admin permission bits intact when unlocking", () => {
    const manageGuild = PermissionsBitField.Flags.ManageGuild;
    const mixed = new PermissionsBitField([
      PermissionsBitField.Flags.Administrator,
      manageGuild,
    ]);
    const json = stripAdministratorDefaultMemberPermissions(
      { default_member_permissions: mixed.bitfield.toString() },
      { [ENV_NAME]: "1" }
    );
    expect(json.default_member_permissions).toBe(String(manageGuild));
  });
});

describe("/config with QA_UNLOCK_ADMIN_COMMANDS", () => {
  const previous = process.env[ENV_NAME];

  afterEach(() => {
    restoreUnlockEnv(previous);
  });

  test("unset keeps Administrator registration and rejects non-admins", async () => {
    delete process.env[ENV_NAME];
    const command = new Config(stubClient());
    const json = command.data.toJSON();
    expect(json.default_member_permissions).toBe(ADMIN);

    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: () => false },
      options: { getSubcommand: () => "show" },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content).toContain("administrators");
  });

  test("set registers /config without Administrator and allows a non-admin", async () => {
    process.env[ENV_NAME] = "1";
    const store = {};
    const client = {
      ...stubClient(),
      getSettings: () => ({ ...store }),
      writeSettings: (_id, newSettings) => Object.assign(store, newSettings),
    };
    const command = new Config(client);
    const json = command.data.toJSON();
    expect(json.default_member_permissions == null).toBe(true);

    const replies = [];
    await command.execute({
      guildId: "guild-1",
      guild: { id: "guild-1" },
      memberPermissions: { has: () => false },
      options: {
        getSubcommand: () => "winner-portraits",
        getBoolean: () => false,
      },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content.toLowerCase()).toContain("off");
    expect(replies[0].content.toLowerCase()).not.toContain("administrators");
  });
});

describe("/settings with QA_UNLOCK_ADMIN_COMMANDS", () => {
  const previous = process.env[ENV_NAME];

  afterEach(() => {
    restoreUnlockEnv(previous);
  });

  test("unset keeps the Administrator Discord gate", () => {
    delete process.env[ENV_NAME];
    const json = new Settings(stubClient()).data.toJSON();
    expect(json.default_member_permissions).toBe(ADMIN);
  });

  test("set drops the Discord gate but keeps the bot-owner runtime check", async () => {
    process.env[ENV_NAME] = "1";
    const command = new Settings(stubClient());
    expect(command.data.toJSON().default_member_permissions == null).toBe(true);

    const replies = [];
    await command.execute({
      member: { id: "not-owner" },
      options: { getString: () => "activity" },
      reply: async (payload) => replies.push(payload),
    });
    expect(replies[0].content).toContain("Bot Owner");
  });
});
