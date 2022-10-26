const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const Roller = require("roll");

const dieMap = {
  1: {
    name: "🗡️/🏹",
    sword: 1,
    bow: 1,
    rune: 0,
  },
  2: {
    name: "🏹/♓",
    sword: 0,
    bow: 1,
    rune: 1,
  },
  3: {
    name: "🗡️/🏹",
    sword: 1,
    bow: 1,
    rune: 0,
  },
  4: {
    name: "🗡️/♓",
    sword: 1,
    bow: 0,
    rune: 1,
  },
  5: {
    name: "🗡️/🏹",
    sword: 1,
    bow: 1,
    rune: 0,
  },
  6: {
    name: "🗡️",
    sword: 1,
    bow: 0,
    rune: 0,
  },
};

class Summoner extends Command {
  constructor(client) {
    super(client, {
      name: "summoner",
      description: "Roll Some Summoner Wars",
      category: "Summoner Wars",
      usage:
        "use command followed by the number of dice to roll (if no number is added, only 1 die will be rolled)",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: ["summonerwars", "summoner-wars", "sw"],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      let rollCount = 1;
      if (args[0] && !isNaN(args[0])) {
        rollCount = parseInt(args[0]);
      }

      var roll = new Roller();
      let swordTotal = 0;
      let bowTotal = 0;
      let runeTotal = 0;
      let debug = "";
      let display = "";

      for (var i = 0; i < rollCount; i++) {
        if (i > 0) display += `, `;
        var results = roll.roll("d6");
        debug += `${results.result} `;
        display += `${dieMap[results.result].name}`;
        swordTotal += dieMap[results.result].sword;
        bowTotal += dieMap[results.result].bow;
        runeTotal += dieMap[results.result].rune;
      }

      const statusEmbed = new EmbedBuilder()
        .setColor(4130114)
        .setTitle("Summoner Wars Roll")
        .setTimestamp()
        .setDescription(`
            Rolls: ${display}

            Swords: ${swordTotal}
            Bows: ${bowTotal}
            Runes: ${runeTotal}
            `)
      .setFooter({text: `dice: ${debug}`});
      message.channel.send({ embeds: [statusEmbed] });
    } catch (e) {
      this.client.logger.log(e, "error");
    }
  }
}

module.exports = Summoner;
