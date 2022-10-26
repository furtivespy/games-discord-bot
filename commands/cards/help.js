const Command = require("../../base/Command.js");
const { EmbedBuilder } = require("discord.js");
const _ = require("lodash");

class Help extends Command {
  constructor(client) {
    super(client, {
      name: "cards-help",
      description: "Card Game Help - Shows all commands for Card games",
      category: "Cards",
      usage: "use this command to get Cards Help",
      enabled: true,
      guildOnly: false,
      allMessages: false,
      showHelp: true,
      aliases: ["card-help", "chelp"],
      permLevel: "User",
    });
  }

  async run(message, args, level) {
    try {
      const cardsEmbed = new EmbedBuilder()
        .setColor(13928716)
        .setTitle("Card Game Helper Help")
        .setTimestamp()
        .setDescription("**Commands:**")
        .addFields(
          {
            name: `Cards`,
            value: `Basic command that shows active card decks in the channel\n \`&cards\``,
            inline: true,
          },
          {
            name: `New`,
            value: `Add a new deck to the channel (use without parameters to get detailed help)\n \`&cards new\``,
            inline: true,
          },
          {
            name: `Remove`,
            value: `Removes a deck from the channel\n \`&cards remove deckname\``,
            inline: true,
          },
          {
            name: `Shuffle`,
            value: `Shuffles a deck (newly added decks will not be shuffled at first)\n \`&cards shuffle deckname\``,
            inline: true,
          },
          {
            name: `Flip`,
            value: `Flips the top card(s) off the deck\n \`&cards flip deckname [number]\``,
            inline: true,
          },
          {
            name: `Draw`,
            value: `Draw a card from a deck into your hand\n \`&cards draw deckname\``,
            inline: true,
          },
          {
            name: `Hand`,
            value: `Let's you see the cards in your hand\n \`&cards hand\``,
            inline: true,
          },
          {
            name: `Discard`,
            value: `Discard a card\n \`&cards discard\``,
            inline: true,
          },
          {
            name: `Play`,
            value: `play a card (same as discard, but shown to everyone)\n \`&cards play\``,
            inline: true,
          },
          {
            name: `Reminder`,
            value: `All commands for card game start with \`&cards\` or \`&c\``,
          }
        )
      await message.channel.send({ embeds: [cardsEmbed] });
    } catch (e) {
      this.client.logger.error(e, __filename.slice(__dirname.length + 1));
    }
  }
}

module.exports = Help;
