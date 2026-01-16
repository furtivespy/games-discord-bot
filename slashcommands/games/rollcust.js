const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class RollCust extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "rollcust",
      description: "Roll a custom die",
      usage: "rollcust",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("name")
          .setDescription("Name of the die")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("count")
          .setDescription("Number of dice to roll (default 1)")
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(100)
      );
  }

  async execute(interaction) {
    try {
      if (interaction.isAutocomplete()) {
        await this.autocomplete(interaction);
        return;
      }

      const name = interaction.options.getString("name");
      const count = interaction.options.getInteger("count") || 1;

      // Find the die
      const guildData = await this.client.getGuildData(interaction.guildId);
      const gameData = await this.client.getGameDataV2(interaction.guildId, "game", interaction.channelId);

      let die = null;
      let source = "";

      // Check game dice first (priority? or user choice? logic says local overrides global usually)
      // Wait, collision check prevents duplicates with same name.
      // So I can check either order.

      if (gameData && !gameData.isdeleted && gameData.customDice) {
        die = gameData.customDice.find((d) => d.name.toLowerCase() === name.toLowerCase());
        if (die) source = "Game Die";
      }

      if (!die && guildData.customDice) {
        die = guildData.customDice.find((d) => d.name.toLowerCase() === name.toLowerCase());
        if (die) source = "Server Die";
      }

      if (!die) {
        return interaction.reply({
          content: `Custom die "${name}" not found.`,
          ephemeral: true,
        });
      }

      // Roll
      const results = [];
      for (let i = 0; i < count; i++) {
        results.push(_.sample(die.sides));
      }

      // Format output
      let description = "";

      // Try to calculate total if all results are numeric
      const areAllNumeric = results.every(r => !isNaN(parseFloat(r)) && isFinite(r));
      let total = 0;
      if (areAllNumeric) {
          total = results.reduce((a, b) => a + parseFloat(b), 0);
          description = `Total rolled: **${total}**\n\n`;
      }

      description += results.join(", ");

      const embed = new EmbedBuilder()
        .setTitle(`${count}x ${die.name} (${source})`)
        .setDescription(description)
        .setColor(4130114) // Same color as roll.js
        .setFooter({ text: `Sides: [${die.sides.join(", ")}]` });

      // Optional: Add image if single numeric result (like roll.js)
      /*
      if (areAllNumeric && this.client.googleClient) {
          try {
             let query = `number ${total}`;
             let img = await this.client.googleClient.getRandomGoogleImg(query, false, true);
             if (img && img.link) {
                 embed.setThumbnail(img.link);
             }
          } catch (e) {
              // ignore image error
          }
      }
      */
     // I'll skip the image fetch to keep it snappy and avoid API quotas for now, unless requested.

      await interaction.reply({ embeds: [embed] });

    } catch (e) {
      this.client.logger.log(e, "error");
      // Autocomplete shouldn't reply, but execute should
      if (!interaction.isAutocomplete()) {
          if (interaction.replied || interaction.deferred) {
              await interaction.followUp({ content: `An error occurred: ${e.message}`, ephemeral: true });
          } else {
              await interaction.reply({ content: `An error occurred: ${e.message}`, ephemeral: true });
          }
      }
    }
  }

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();

    const guildData = await this.client.getGuildData(interaction.guildId);
    let gameData = null;
    try {
        // Optimization: maybe we don't need full game data migration for autocomplete?
        // But getGameDataV2 handles caching mostly.
        gameData = await this.client.getGameDataV2(interaction.guildId, "game", interaction.channelId);
    } catch (e) {
        // ignore
    }

    let choices = [];

    // Add server dice
    if (guildData.customDice) {
        choices.push(...guildData.customDice.map(d => d.name));
    }

    // Add game dice
    if (gameData && !gameData.isdeleted && gameData.customDice) {
        choices.push(...gameData.customDice.map(d => d.name));
    }

    // Filter and limit to 25
    const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue)).slice(0, 25);

    await interaction.respond(
      filtered.map(choice => ({ name: choice, value: choice }))
    );
  }
}

module.exports = RollCust;
