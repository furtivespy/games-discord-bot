const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class Help extends Command {
  constructor(client) {
    super(client, {
      name: "game-help",
      description: "Channel Game Help - Shows all commands for channel games",
      category: "Generic Game",
      usage: "use this command to get Generic Game Help",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: ["gamehelp", "ghelp"],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      const cardsEmbed = new EmbedBuilder()
        .setColor(2319795)
        .setTitle("Generic Game Helper Help")
        .setTimestamp()
        .setDescription("**Commands:**")
        .addFields(
          {
            name: `Start`,
            value: `start a new game in the channel\n \`&game start [GameName] @player1 @player2\``,
            inline: true,
          },
          {
            name: `Score`,
            value: `see or adjust the current game scores\n \`&game score\``,
            inline: true,
          },
          {
            name: `Cards`,
            value: `Cards are part of a generic game\n \`&cards help\``,
            inline: true,
          }
        );
      await message.channel.send({ embeds: [cardsEmbed] });
    } catch (e) {
      this.client.logger.error(e, __filename.slice(__dirname.length + 1));
    }
  }
}

module.exports = Help;
