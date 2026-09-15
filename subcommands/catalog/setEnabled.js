const { isCatalogEnabled, isEnabled } = require("../../db/deckCatalog.js");
const {
  autocompleteTemplates,
  catalogUnavailableReply,
  openReadyCatalog,
  replyEphemeral,
} = require("./shared.js");

const FLAG_COPY = {
  0: {
    already: (template) =>
      `\`${template.id}\` (${template.name}) is already disabled.`,
    success: (template) =>
      [
        `Disabled \`${template.id}\` (${template.name}). Live games are unchanged.`,
        "This set will no longer appear in `/cards deck new`.",
      ].join("\n"),
    autocompletePredicate: isEnabled,
  },
  1: {
    already: (template) =>
      `\`${template.id}\` (${template.name}) is already enabled.`,
    success: (template) =>
      `Enabled \`${template.id}\` (${template.name}). Live games are unchanged.`,
    autocompletePredicate: (template) => !isEnabled(template),
  },
};

async function setCatalogEnabled(interaction, enabled) {
  const wantEnabled = isCatalogEnabled(enabled) ? 1 : 0;
  const copy = FLAG_COPY[wantEnabled];
  const opened = openReadyCatalog();
  const { ready, catalog } = opened;

  if (interaction.isAutocomplete()) {
    try {
      if (!ready) {
        await interaction.respond([]);
        return;
      }
      const focused = interaction.options.getFocused();
      await interaction.respond(
        autocompleteTemplates(
          catalog.listTemplates(),
          focused,
          copy.autocompletePredicate
        )
      );
    } finally {
      catalog?.close();
    }
    return;
  }

  if (!ready) {
    return interaction.reply(catalogUnavailableReply(opened.info));
  }

  try {
    const id = interaction.options.getString("id");
    const template = catalog.getTemplate(id);
    if (!template) {
      await replyEphemeral(
        interaction,
        `No catalog template with id "${id}".`
      );
      return;
    }
    if (isEnabled(template) === (wantEnabled === 1)) {
      await replyEphemeral(interaction, copy.already(template));
      return;
    }

    catalog.setEnabled(id, wantEnabled);
    await replyEphemeral(interaction, copy.success(template));
  } finally {
    catalog.close();
  }
}

function createSetEnabledCommand(enabled) {
  return {
    async execute(interaction) {
      return setCatalogEnabled(interaction, enabled);
    },
  };
}

module.exports = {
  setCatalogEnabled,
  createSetEnabledCommand,
  disable: createSetEnabledCommand(0),
  enable: createSetEnabledCommand(1),
};
