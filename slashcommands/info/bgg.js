const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fetch = require("node-fetch");
const { parse } = require("fast-xml-parser");
const { find } = require("lodash");
const he = require("he");
const TurndownService = require("turndown");
const { createCanvas, Image, loadImage } = require("canvas");

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
        let turndownForWhat = new TurndownService();
        let gameInfoResp = await fetch(
          `https://api.geekdo.com/xmlapi/boardgame/${search}?stats=1`
        );
        let gameInfo = parse(await gameInfoResp.text(), {
          attributeNamePrefix: "",
          textNodeName: "text",
          ignoreAttributes: false,
          ignoreNameSpace: true,
          allowBooleanAttributes: true,
          // ignoreRootElement: true, // TODO: awaiting https://github.com/NaturalIntelligence/fast-xml-parser/issues/282
        }).boardgames.boardgame;

        //console.log(JSON.stringify(gameInfo));

        const gameName = Array.isArray(gameInfo.name)
          ? find(gameInfo.name, { primary: "true" }).text
          : gameInfo.name.text;

        let allEmbeds = [];
        //Embed 1 - Image
        const gameImage = await loadImage(gameInfo.image);
        const scaledWidth = 600;
        let canvas = createCanvas(scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
        let ctx = canvas.getContext("2d");
        ctx.drawImage(gameImage, 0, 0, scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
        const imageAttach = new AttachmentBuilder(
          canvas.toBuffer(),
          {name: `gameImage.png`}
        );

        let imageEmbed = new EmbedBuilder()
          .setTitle(he.decode(gameName))
          .setURL(`https://boardgamegeek.com/boardgame/${search}`)
          .setImage(`attachment://gameImage.png`);
        allEmbeds.push(imageEmbed);

        //Embed 2 - Stats and Details
        let ranks = ""
        if (Array.isArray(gameInfo.statistics.ratings.ranks.rank)) {
          gameInfo.statistics.ratings.ranks.rank.forEach(r => {ranks += `\n**${r.friendlyname}:** ${r.value}`})
        } else {
          ranks += `\n**${gameInfo.statistics.ratings.ranks.rank.friendlyname}:** ${gameInfo.statistics.ratings.ranks.rank.value}`
        }
        let detailEmbed = new EmbedBuilder().setTitle(`Details`).addFields(
          {
            name: "Game Data",
            value: `**Published:** ${gameInfo.yearpublished}\n**Players:** ${gameInfo.minplayers} - ${gameInfo.maxplayers}\n**Playing Time:** ${gameInfo.minplaytime} - ${gameInfo.maxplaytime}\n**Age:** ${gameInfo.age}+`,
            inline: true,
          },
          {
            name: `Ranks & Ratings`,
            value: `**Average Rating:** ${gameInfo.statistics.ratings.average}\n**Weight:** ${gameInfo.statistics.ratings.averageweight}${ranks}`,
            inline: true,
          },
          {
            name: `Designer(s)`,
            value: Array.isArray(gameInfo.boardgamedesigner) ? gameInfo.boardgamedesigner.map(d => d.text).join("\n") : gameInfo.boardgamedesigner.text,
            inline: true
          }
        );
        allEmbeds.push(detailEmbed);

        //Embed 3 - Description
        let descriptionEmbed = new EmbedBuilder()
          .setTitle("Description")
          .setDescription(
            turndownForWhat.turndown(he.decode(gameInfo.description))
          );
        allEmbeds.push(descriptionEmbed);

        //Embed 4 - awards and honors
        if (gameInfo.boardgamehonor && Array.isArray(gameInfo.boardgamehonor)) {
          let honors = "";
          gameInfo.boardgamehonor.forEach((honor) => {
            honors += `${he.decode(honor.text)}\n`;
          });
          let awardEmbed = new EmbedBuilder()
            .setTitle(`Awards and Honors`)
            .setDescription(honors);
          allEmbeds.push(awardEmbed);
        }

        await interaction.editReply({
          embeds: allEmbeds,
          files: [imageAttach],
        });
      }
    } catch (e) {
      this.client.logger.log(e, "error");
    }
  }
}

module.exports = BGG;
