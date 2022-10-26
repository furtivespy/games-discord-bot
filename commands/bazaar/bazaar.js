const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class Bazaar extends Command {
  constructor(client) {
    super(client, {
      name: "bazaar",
      description: "Bazaar Game Helper",
      category: "Bazaar",
      usage: "use this command to get Bazaar Help",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: ["bazaar-help", "b"],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      if (args[0]) {
        const newCmd = args.shift();
        this.client.TryExecuteCommand(
          "bazaar-" + newCmd.toLowerCase(),
          message,
          args
        );
      } else {
        const bazaarEmbed = new EmbedBuilder()
          .setColor(2770926)
          .setTitle("Bazaar Game Help")
          .setTimestamp()
          .addFields(
            {
              name: `Commands`,
              value: `
                **Game**  - Current Game Status
                **NewGame**  - Start a new game. Will overwrite current game in the channel. Needs players. e.g. \`&bazaar newgame @furtivespy\`
                **Rules** - Displays the rules of Bazaar
                **Market** - Shows the current exchange market
                **Action** - When it's your turn, use action to take turn`,
            },
            {
              name: `Reminder`,
              value: `All commands for bazaar game start with &bazaar`,
            }
          );
        await message.channel.send({ embeds: [bazaarEmbed] });
      }
    } catch (e) {
      this.client.logger.error(e, __filename.slice(__dirname.length + 1));
    }
  }
}

module.exports = Bazaar;
