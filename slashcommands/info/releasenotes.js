const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");

class ReleaseNotes extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "releasenotes",
      description: "Get release notes for the bot.",
      usage: "Use this command to get release notes",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("version")
          .setDescription("The version to get notes for")
          .setAutocomplete(true)
      );
  }

  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      const focusedValue = interaction.options.getFocused();
      const response = await fetch(`https://api.github.com/repos/furtivespy/games-discord-bot/releases`);
      const releases = await response.json();
      const choices = releases
        .map(release => ({ name: release.name, value: release.tag_name }))
        .filter(choice => choice.name.includes(focusedValue))
        .slice(0, 25);
      await interaction.respond(choices);
      return;
    }

    try {
      await interaction.deferReply();
      const version = interaction.options.getString("version");
      let release;

      if (version) {
        const response = await fetch(`https://api.github.com/repos/furtivespy/games-discord-bot/releases/tags/${version}`);
        release = await response.json();
      } else {
        const response = await fetch(`https://api.github.com/repos/furtivespy/games-discord-bot/releases/latest`);
        release = await response.json();
      }

      if (release.message === "Not Found") {
        await interaction.editReply({ content: `Release notes for version ${version} not found.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(release.name)
        .setURL(release.html_url)
        .setTimestamp(new Date(release.published_at))
        .setDescription(release.body.length > 4096 ? release.body.substring(0, 4093) + "..." : release.body)
        .setColor("#0099ff")
        .setAuthor({ name: release.author.login, iconURL: release.author.avatar_url, url: release.author.html_url })
        .setFooter({ text: `Version: ${release.tag_name}` });

      await interaction.editReply({ embeds: [embed] });

    } catch (e) {
      this.client.logger.log(e, "error");
      await interaction.editReply({ content: "An error occurred while fetching release notes.", ephemeral: true });
    }
  }
}

module.exports = ReleaseNotes;