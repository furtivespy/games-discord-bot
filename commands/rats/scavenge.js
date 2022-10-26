const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const Roller = require("roll");
const _ = require("lodash");
const diceSides = [
  "<:die1:790027072998342666>",
  "<:die2:790028311756668960>",
  "<:die3:790028312167841803>",
  "<:die4:790028312348065842>",
  "<:die5:790028312386076713>",
  "<:die6:790028312495128616>",
];

const data = {
  1: { emoji: "<:die1:790027072998342666>", name: "Cocktail Swords" },
  2: { emoji: "<:die2:790028311756668960>", name: "Baubles" },
  3: { emoji: "<:die3:790028312167841803>", name: "Straw" },
  4: { emoji: "<:die4:790028312348065842>", name: "Crumbs" },
  5: { emoji: "<:die5:790028312386076713>", name: "Rags" },
  6: { emoji: "<:die6:790028312495128616>", name: "Flowers" },
};

class Scavenge extends Command {
  constructor(client) {
    super(client, {
      name: "rats-scavenge",
      description: "RATS game",
      category: "Rats",
      usage: "use this command to roll scavenge rolls",
      enabled: true,
      guildOnly: true,
      allMessages: false,
      showHelp: false,
      aliases: [
        "rat-scavenge",
        "ratsscavenge",
        "ratscavenge",
        "rats-scav",
        "rat-scav",
        "rat-s",
      ],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      const ratsEmbed = new EmbedBuilder()
        .setColor(5582350)
        .setTitle("Another Round of Scavenging")
        .setTimestamp()
        .addFields(
          {
            name: `Scavenge #1`,
            value: `|| ${Scavenge.getScavenge()} ${Scavenge.randomPadding()} ||`,
          },
          {
            name: `Scavenge #2`,
            value: `|| ${Scavenge.getScavenge()} ${Scavenge.randomPadding()} ||`,
          },
          {
            name: `Scavenge #3`,
            value: `|| ${Scavenge.getScavenge()} ${Scavenge.randomPadding()} ||`,
          }
        )
        .setFooter({ text: `React with 🐀 when done scavenging` });

      let msg = await message.channel.send({ embeds: [ratsEmbed] });
      await msg.react("🐀");
    } catch (e) {
      this.client.logger.error(e, __filename.slice(__dirname.length + 1));
    }
  }

  static getScavenge() {
    const die1 = _.random(1, 6);
    const die2 = _.random(1, 6);
    const results = `${data[die1].emoji} & ${data[die2].emoji}`;
    let details = "";
    if (die1 == die2) {
      details = `${die1} of any one party supply`;
    } else {
      details = `${die1} of ${data[die2].name} or ${die2} of ${data[die1].name}`;
    }
    return `${results}\n${details}`;
  }

  static randomPadding() {
    const len = _.random(5, 50);
    let dots = "";
    for (let i = 0; i < len; i++) {
      dots += ".";
    }
    return dots;
  }

  static getDie() {
    return _.sample([...diceSides]);
  }
}

module.exports = Scavenge;
