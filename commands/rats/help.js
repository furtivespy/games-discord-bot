const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class Help extends Command {
  constructor(client) {
    super(client, {
      name: "rats-help",
      description: "Help for all the Rats game commands",
      category: "Rats",
      usage: "use this command to get rats Help",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: ["rats-help", "rathelp", "ratshelp"],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      const ratsEmbed = new EmbedBuilder()
        .setColor(5582350)
        .setTitle("Rat Game Helper Help")
        .setTimestamp()
        .setDescription("**Commands:**")

        .addFields(
          {
            name: `Rats`,
            value: `Basic command that shows this help\n \`&rats\``,
            inline: true,
          },
          {
            name: `Scavenge`,
            value: `Roll some scavenge rolls\n \`&rats scavenge\``,
            inline: true,
          },
          {
            name: `Reminder`,
            value: `All commands for this game start with \`&rats\` or \`&rat\`. If you need rules or to print a character sheet visit https://www.shutupandsitdown.com/rats/`,
          }
        );
      await message.channel.send({ embeds: [ratsEmbed] });
    } catch (e) {
      this.client.logger.error(e, __filename.slice(__dirname.length + 1));
    }
  }
}

module.exports = Help;
