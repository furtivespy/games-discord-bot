const SlashCommand = require("../../base/SlashCommand.js");
const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require("discord.js");
const _ = require("lodash");

class Dice extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "dice",
      description: "Manage custom dice",
      usage: "dice",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Add a new custom die")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the die")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("sides")
              .setDescription("Comma separated list of sides (e.g. 1,2,3 or 🍎,🍊,🍇)")
              .setRequired(true)
          )
          .addBooleanOption((option) =>
            option
              .setName("is_server")
              .setDescription("Is this a server-wide die?")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("remove")
          .setDescription("Remove a custom die")
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Name of the die to remove")
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("confirm")
              .setDescription("Type 'confirm' to delete")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("list")
          .setDescription("List available custom dice")
      );
  }

  async execute(interaction) {
    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "add":
          await this.addDie(interaction);
          break;
        case "remove":
          await this.removeDie(interaction);
          break;
        case "list":
          await this.listDice(interaction);
          break;
      }
    } catch (e) {
      this.client.logger.log(e, "error");
      await interaction.reply({
        content: `An error occurred: ${e.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  async addDie(interaction) {
    const name = interaction.options.getString("name").trim();
    const sidesStr = interaction.options.getString("sides");
    const isServer = interaction.options.getBoolean("is_server") || false;
    const sides = sidesStr.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

    if (sides.length < 2) {
      return interaction.reply({
        content: "A die must have at least 2 sides.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check for collisions
    const guildData = await this.client.getGuildData(interaction.guildId);
    let gameData = await this.client.getGameDataV2(interaction.guildId, "game", interaction.channelId);

    // Collision check in server dice
    if (guildData.customDice.find((d) => d.name.toLowerCase() === name.toLowerCase())) {
        return interaction.reply({
            content: `A server die with the name "${name}" already exists.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    // Collision check in channel dice (if game active)
    if (gameData && !gameData.isdeleted && gameData.customDice) {
         if (gameData.customDice.find((d) => d.name.toLowerCase() === name.toLowerCase())) {
            return interaction.reply({
                content: `A die with the name "${name}" already exists in this game.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    // Add logic
    if (isServer) {
        // Check permissions? Usually server-wide stuff might need higher perms, but user said "anyone can create/remove dice"
        // so I won't enforce admin check unless specified later.

        guildData.customDice.push({ name, sides });
        await this.client.setGuildData(interaction.guildId, guildData);

        return interaction.reply({
            content: `Server die "${name}" added with sides: ${sides.join(", ")}`,
        });
    } else {
        // Channel die
        if (!gameData || gameData.isdeleted) {
             return interaction.reply({
                content: `There is no active game in this channel. You can only add local dice to an active game.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        gameData.customDice.push({ name, sides });
        await this.client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);

        return interaction.reply({
            content: `Game die "${name}" added with sides: ${sides.join(", ")}`,
        });
    }
  }

  async removeDie(interaction) {
    const name = interaction.options.getString("name").trim();
    const confirm = interaction.options.getString("confirm");

    if (confirm.toLowerCase() !== "confirm") {
      return interaction.reply({
        content: "You must type 'confirm' to remove a die.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildData = await this.client.getGuildData(interaction.guildId);
    let gameData = await this.client.getGameDataV2(interaction.guildId, "game", interaction.channelId);

    let removed = false;
    let location = "";

    // Check server dice
    const serverDieIndex = guildData.customDice.findIndex((d) => d.name.toLowerCase() === name.toLowerCase());
    if (serverDieIndex !== -1) {
        guildData.customDice.splice(serverDieIndex, 1);
        await this.client.setGuildData(interaction.guildId, guildData);
        removed = true;
        location = "server";
    }

    // Check game dice
    if (!removed && gameData && !gameData.isdeleted && gameData.customDice) {
        const gameDieIndex = gameData.customDice.findIndex((d) => d.name.toLowerCase() === name.toLowerCase());
        if (gameDieIndex !== -1) {
            gameData.customDice.splice(gameDieIndex, 1);
            await this.client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData);
            removed = true;
            location = "game";
        }
    }

    if (removed) {
        return interaction.reply({
            content: `Custom die "${name}" removed from ${location}.`,
        });
    } else {
        return interaction.reply({
            content: `Die "${name}" not found.`,
            flags: MessageFlags.Ephemeral,
        });
    }
  }

  async listDice(interaction) {
    const guildData = await this.client.getGuildData(interaction.guildId);
    const gameData = await this.client.getGameDataV2(interaction.guildId, "game", interaction.channelId);

    const embed = new EmbedBuilder()
      .setTitle("Custom Dice List")
      .setColor(0x00AE86);

    // Helper function to format dice list with truncation
    const formatDiceList = (dice, maxLength = 1000) => {
      if (!dice || dice.length === 0) return null;
      
      let result = "";
      let truncated = false;
      
      for (const die of dice) {
        const dieStr = `**${die.name}**: [${die.sides.join(", ")}]\n`;
        if (result.length + dieStr.length > maxLength) {
          truncated = true;
          break;
        }
        result += dieStr;
      }
      
      if (truncated) {
        result += `\n*...and ${dice.length - result.split("\n").filter(l => l.trim()).length} more dice*`;
      }
      
      return result.trim();
    };

    let serverList = formatDiceList(guildData.customDice);
    if (!serverList) {
      serverList = "No server dice.";
    }
    embed.addFields({ name: "Server Dice", value: serverList });

    let gameList = null;
    if (gameData && !gameData.isdeleted && gameData.customDice) {
      gameList = formatDiceList(gameData.customDice);
    }
    if (!gameList) {
      gameList = "No active game or no game dice.";
    }
    embed.addFields({ name: "Channel/Game Dice", value: gameList });

    return interaction.reply({ embeds: [embed] });
  }
}

module.exports = Dice;
