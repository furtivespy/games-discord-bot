const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fetch = require("node-fetch");
const BoardGameGeek = require('../../modules/BoardGameGeek')

class BGG extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "bgg",
      description: "Look up a game on Board Game Geek",
      usage: "Use this command to find a game",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .addStringOption((option) =>
        option
          .setName("game")
          .setDescription("The game to find")
          .setAutocomplete(true)
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("details")
          .setDescription("Amount of details to show")
          .addChoices(
            {name: "All Details (default)", value: BoardGameGeek.DetailsEnum.ALL},
            {name: "Only Description", value: BoardGameGeek.DetailsEnum.BASIC},
            {name: "Only History", value: BoardGameGeek.DetailsEnum.HISTORY},
            {name: "Only Awards", value: BoardGameGeek.DetailsEnum.AWARDS},
          )
      );

  }

  async execute(interaction) {
    try {
      const search = interaction.options.getString("game");
      if (interaction.isAutocomplete()) {
        if (!search) {
          await interaction.respond([]);
          return;
        }
        let query = new URLSearchParams();
        query.set("q", search);
        query.set("nosession", 1);
        query.set("showcount", 20);
        let results = await fetch(
          `https://boardgamegeek.com/search/boardgame?${query.toString()}`,
          {
            headers: {
              accept: "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "sec-ch-ua":
                '"Google Chrome";v="105", "Not)A;Brand";v="8", "Chromium";v="105"',
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              Referer: "https://boardgamegeek.com/",
              "Referrer-Policy": "strict-origin-when-cross-origin",
            },
          }
        );
        let games = await results.json();
        //console.log(JSON.stringify(games))
        await interaction.respond(
          games.items.map((gameItem) => ({
            name: `${gameItem.ordtitle} (${gameItem.yearpublished})`,
            value: gameItem.objectid,
          }))
        );
      } else {
        if (isNaN(search)){
          await interaction.reply({
            content: `Please choose from the available options`,
            ephemeral: true
          })
          return
        }

        await interaction.deferReply();
       
        let bgg = await BoardGameGeek.CreateAndLoad(search, this.client, interaction)
        await bgg.LoadEmbeds(interaction.options.getString("details") || BoardGameGeek.DetailsEnum.ALL)

        await interaction.editReply({
          embeds: bgg.embeds,
          files: bgg.attachments,
        });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
    }
  }
}

module.exports = BGG;
