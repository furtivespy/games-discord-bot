const { EmbedBuilder } = require("discord.js");

const playingCards = [
  "A♣",
  "K♣",
  "Q♣",
  "J♣",
  "2♣",
  "3♣",
  "4♣",
  "5♣",
  "6♣",
  "7♣",
  "8♣",
  "9♣",
  "10♣",
  "A♦",
  "K♦",
  "Q♦",
  "J♦",
  "2♦",
  "3♦",
  "4♦",
  "5♦",
  "6♦",
  "7♦",
  "8♦",
  "9♦",
  "10♦",
  "A♥",
  "K♥",
  "Q♥",
  "J♥",
  "2♥",
  "3♥",
  "4♥",
  "5♥",
  "6♥",
  "7♥",
  "8♥",
  "9♥",
  "10♥",
  "A♠",
  "K♠",
  "Q♠",
  "J♠",
  "2♠",
  "3♠",
  "4♠",
  "5♠",
  "6♠",
  "7♠",
  "8♠",
  "9♠",
  "10♠",
];
const pairCards = [
  ":one:",
  ":two:",
  ":two:",
  ":three:",
  ":three:",
  ":three:",
  ":four:",
  ":four:",
  ":four:",
  ":four:",
  ":five:",
  ":five:",
  ":five:",
  ":five:",
  ":five:",
  ":six:",
  ":six:",
  ":six:",
  ":six:",
  ":six:",
  ":six:",
  ":seven:",
  ":seven:",
  ":seven:",
  ":seven:",
  ":seven:",
  ":seven:",
  ":seven:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":eight:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":nine:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
  ":keycap_ten:",
];

class CardDatabase {
  constructor() {
    //DB INIT SECTION
    this.deckList = [];

    this.deckList.push({
      name: "playing_cards",
      description: "Standard deck of 52 cards",
    });
    this.playing_cards = [...playingCards];

    this.deckList.push({
      name: "triangle",
      description:
        "Simple triangular deck of cards (1×1, 2×2, 3×3, and so on to 10×10)",
    });
    this.triangle = [...pairCards];
  }

  defaultGameData = {
    decks: [],
    players: [],
    name: "",
  };

  defaultDeck = {
    name: "",
    allCards: [],
    currentDeck: [],
    discard: [],
  };

  defaultPlayer = {
    guildId: "1",
    userId: "1",
    order: 1,
    score: "",
    name: null,
    hands: [],
  };

  defaultHand = {
    deck: "",
    cards: [],
  };

  handEmbed(playerData, guildName, channelName) {
    const cardsEmbed = new EmbedBuilder()
      .setColor(13928716)
      .setTitle(`All cards in hand in #${channelName} at ${guildName}`)
      .setTimestamp();
    playerData.hands.forEach((element) => {
      if (element.cards.length > 0) {
        cardsEmbed.addFields({
          name: `From ${element.deck} deck`,
          value: element.cards.sort().join("\n"),
        });
      } else {
        cardsEmbed.addFields({
          name: `From ${element.deck} deck`,
          value: "No cards",
        });
      }
    });
    return cardsEmbed;
  }
}

module.exports = new CardDatabase();
