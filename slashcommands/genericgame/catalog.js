const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const List = require("../../subcommands/catalog/list.js");
const Show = require("../../subcommands/catalog/show.js");
const Disable = require("../../subcommands/catalog/disable.js");
const Enable = require("../../subcommands/catalog/enable.js");
const Publish = require("../../subcommands/catalog/publish.js");
const {
  catalogEmbed,
  isBotOwner,
  notOwnerReply,
} = require("../../subcommands/catalog/shared.js");

class Catalog extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "catalog",
      description: "Inspect and publish global deck catalog templates (Bot Owner)",
      usage: "catalog",
      enabled: true,
      permLevel: "Bot Owner",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("list")
          .setDescription("List all catalog templates")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("show")
          .setDescription("Show one catalog template and its cards")
          .addStringOption((option) =>
            option
              .setName("id")
              .setDescription("Catalog template id")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("disable")
          .setDescription("Disable a catalog template (does not delete)")
          .addStringOption((option) =>
            option
              .setName("id")
              .setDescription("Enabled catalog template id")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("enable")
          .setDescription("Re-enable a disabled catalog template")
          .addStringOption((option) =>
            option
              .setName("id")
              .setDescription("Disabled catalog template id")
              .setRequired(true)
              .setAutocomplete(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("publish")
          .setDescription("Save an in-channel deck as a new catalog template")
          .addStringOption((option) =>
            option
              .setName("deck")
              .setDescription("In-game deck in this channel")
              .setRequired(true)
              .setAutocomplete(true)
          )
          .addStringOption((option) =>
            option
              .setName("id")
              .setDescription("New catalog id (lowercase letters, digits, hyphens)")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(100)
          )
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Unique display name for the new template")
              .setRequired(true)
              .setMinLength(1)
              .setMaxLength(100)
          )
      );
  }

  async execute(interaction) {
    try {
      if (!isBotOwner(interaction, this.client)) {
        if (interaction.isAutocomplete()) {
          return interaction.respond([]);
        }
        return interaction.reply(notOwnerReply());
      }

      switch (interaction.options.getSubcommand()) {
        case "list":
          await List.execute(interaction, this.client);
          break;
        case "show":
          await Show.execute(interaction, this.client);
          break;
        case "disable":
          await Disable.execute(interaction, this.client);
          break;
        case "enable":
          await Enable.execute(interaction, this.client);
          break;
        case "publish":
          await Publish.execute(interaction, this.client);
          break;
        default:
          await interaction.reply({
            embeds: [
              catalogEmbed({ description: "Unknown catalog subcommand." }),
            ],
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
      try {
        if (interaction.isAutocomplete()) {
          await interaction.respond([]);
          return;
        }
        if (e?.catalogPrimarySent) {
          return;
        }
        const reply = {
          embeds: [
            catalogEmbed({
              description: "Something went wrong — please try again.",
            }),
          ],
          flags: MessageFlags.Ephemeral,
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (_) {}
    }
  }
}

module.exports = Catalog;
