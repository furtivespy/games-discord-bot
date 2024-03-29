const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class Inis extends Command {
  constructor(client) {
    super(client, {
      name: "inis",
      description: "Inis Game Helper",
      category: "Inis",
      usage: "use this command to get Inis Help",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: [],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      if (args[0]) {
        const newCmd = args.shift();
        this.client.TryExecuteCommand(
          "inis-" + newCmd.toLowerCase(),
          message,
          args
        );
      } else {
        const inisEmbed = new EmbedBuilder()
          .setColor(386945)
          .setTitle("Inis Game Help")
          .setTimestamp()
          .addFields({
            name: `Commands`,
            value: `
                **Game**  - Current Game Status
                **Card**  - Info on a card. expects a name or search term
                **Crows** - Flips the flock of crows direction
                **Brenn** - Assigns a new brenn
                **NewGame** - Starts a new game
                **NewSeason** - States a new season
                **ViewDiscard** - Views the seasons's set aside card`,
          });
        await message.channel.send({ embeds: [inisEmbed] });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
    }
  }
}

module.exports = Inis;
