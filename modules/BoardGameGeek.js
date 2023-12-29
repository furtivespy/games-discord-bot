const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fetch = require("node-fetch");
const { parse } = require("fast-xml-parser");
const { find, cloneDeep, take } = require("lodash");
const { createCanvas, Image, loadImage } = require("canvas");
const he = require("he");
const TurndownService = require("turndown");
const Formatter = require('./GameFormatter')
const GameDB = require('../db/anygame.js')

class BoardGameGeek {
  constructor(gameId, discordClient, interaction) {
    this.gameId = gameId;
    this.discordClient = discordClient;
    this.interaction = interaction;
    this.embeds = [];
    this.attachments = [];
    this.otherAttachments = [];
  }

  static async CreateAndLoad(gameId, discordClient, interaction) {
    let bgg = new BoardGameGeek(gameId, discordClient, interaction);
    await bgg.LoadBggData();
    return bgg;
  }

  static DetailsEnum = {
    ALL: 'all',
    BASIC: 'basic',
    HISTORY: 'history',
    AWARDS: 'awards',
    ALLPLUS: 'allplus',
    LINKS: 'links',
    ALLEPHEMERAL: 'allephemeral',
    LINKSEPHMERAL: 'linksephemeral',
  }

  static isEphemeral(detailsType) {
    if (detailsType == BoardGameGeek.DetailsEnum.ALLEPHEMERAL ||
        detailsType == BoardGameGeek.DetailsEnum.LINKSEPHMERAL) 
    {
      return true
    }
    return false
  }

  async LoadBggData() {
    //console.log(`Loading BGG Data for ${this.gameId}`);
    let gameInfoResp = await fetch(
      `https://api.geekdo.com/xmlapi/boardgame/${this.gameId}?stats=1`
    );
    this.gameInfo = parse(await gameInfoResp.text(), {
      attributeNamePrefix: "",
      textNodeName: "text",
      ignoreAttributes: false,
      ignoreNameSpace: true,
      allowBooleanAttributes: true,
      // ignoreRootElement: true, // TODO: awaiting https://github.com/NaturalIntelligence/fast-xml-parser/issues/282
    }).boardgames.boardgame;

    //console.log(JSON.stringify(this.gameInfo));

    const gameName = Array.isArray(this.gameInfo.name)
      ? find(this.gameInfo.name, { primary: "true" }).text
      : this.gameInfo.name.text;

    this.gameName = he.decode(gameName);
  }

  async LoadEmbeds(detailsType) {
    switch (detailsType) {
      case BoardGameGeek.DetailsEnum.BASIC:
        await this.GetGameImageEmbed()
        this.GetGameDescriptionEmbed()
        break;
      case BoardGameGeek.DetailsEnum.HISTORY:
        await this.GetGameImageEmbed()
        await this.GetHistoryEmbed()
        break;
      case BoardGameGeek.DetailsEnum.AWARDS:
        await this.GetGameImageEmbed()
        this.GetGameAwardsEmbed()
        break;
      case BoardGameGeek.DetailsEnum.LINKS:
      case BoardGameGeek.DetailsEnum.LINKSEPHMERAL:
        await this.GetGameImageEmbed()
        await this.GetUsefulLinksEmbed()
        break;
      case BoardGameGeek.DetailsEnum.ALLPLUS:
      case BoardGameGeek.DetailsEnum.ALLEPHEMERAL:
        await this.GetGameImageEmbed()
        this.GetGameDetailsEmbed()
        this.GetGameDescriptionEmbed()
        this.GetGameAwardsEmbed()
        await this.GetHistoryEmbed()
        await this.GetUsefulLinksEmbed()
        break;
      case BoardGameGeek.DetailsEnum.ALL:
      default:
        await this.GetGameImageEmbed()
        this.GetGameDetailsEmbed()
        this.GetGameDescriptionEmbed()
        this.GetGameAwardsEmbed()
        await this.GetHistoryEmbed()
        break;
    }
  }

  async GetGameImageEmbed() {
    //Embed 1 - Image
    const gameImage = await loadImage(this.gameInfo.image);
    const scaledWidth = 600;
    let canvas = createCanvas(scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
    let ctx = canvas.getContext("2d");
    ctx.drawImage(gameImage, 0, 0, scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
    const imageAttach = new AttachmentBuilder(
      canvas.toBuffer(),
      {name: `gameImage.png`}
    );
    this.attachments.push(imageAttach);

    let imageEmbed = new EmbedBuilder()
      .setTitle(this.gameName)
      .setURL(`https://boardgamegeek.com/boardgame/${this.gameId}`)
      .setImage(`attachment://gameImage.png`);
    this.embeds.push(imageEmbed);
  }

  GetGameDetailsEmbed() {
    //Embed 2 - Stats and Details
    let ranks = ""
    if (Array.isArray(this.gameInfo.statistics.ratings.ranks.rank)) {
      this.gameInfo.statistics.ratings.ranks.rank.forEach(r => {ranks += `\n**${he.decode(r.friendlyname)}:** ${r.value}`})
    } else {
      ranks += `\n**${he.decode(this.gameInfo.statistics.ratings.ranks.rank.friendlyname)}:** ${this.gameInfo.statistics.ratings.ranks.rank.value}`
    }
    //let publisher = Array.isArray(this.gameInfo.boardgamepublisher) ? this.gameInfo.boardgamepublisher.map(d => d.text).join(", ") : this.gameInfo.boardgamepublisher.text
    let suggestedPlayers = ""
    let suggestedPlayerPoll = find(this.gameInfo.poll, {name: "suggested_numplayers"})
    suggestedPlayerPoll.results.map(x => x.result.sort((a, b) => b.numvotes - a.numvotes))
    suggestedPlayerPoll.results.forEach(r => {
      suggestedPlayers += `\n**${r.numplayers}**: ${r.result[0].value}`
    })
    
    let detailEmbed = new EmbedBuilder().setTitle(`Details`).addFields(
      {
        name: "Game Data",
        value: `**Published:** ${this.gameInfo.yearpublished}\n**Players:** ${this.gameInfo.minplayers} - ${this.gameInfo.maxplayers}\n**Playing Time:** ${this.gameInfo.minplaytime} - ${this.gameInfo.maxplaytime}\n**Age:** ${this.gameInfo.age}+`,
        inline: true,
      },
      {
        name: `Ranks & Ratings`,
        value: `**Average Rating:** ${this.gameInfo.statistics.ratings.average}\n**Weight:** ${this.gameInfo.statistics.ratings.averageweight}${ranks}`,
        inline: true,
      },
      {
        name: `Suggested Player Count`,
        value: `${suggestedPlayers}`,
        inline: true,
      },
      {
        name: `Designer(s)`,
        value: this.gameInfo.boardgamedesigner ? Array.isArray(this.gameInfo.boardgamedesigner) ? this.gameInfo.boardgamedesigner.map(d => d.text).join("\n") : this.gameInfo.boardgamedesigner.text : "N/A",
        inline: true
      },
      {
        name: `Publisher(s)`,
        value: Array.isArray(this.gameInfo.boardgamepublisher) ? this.gameInfo.boardgamepublisher.map(d => d.text).join("\n") : this.gameInfo.boardgamepublisher.text,
        inline: true
      }
    );
    if (this.gameInfo.boardgamemechanic) {
      detailEmbed.addFields(
        {
          name: `Mechanics`,
          value: Array.isArray(this.gameInfo.boardgamemechanic) ? this.gameInfo.boardgamemechanic.map(d => d.text).join("\n") : this.gameInfo.boardgamemechanic.text,
          inline: true
        }
      );
    }
    if (this.gameInfo.boardgameexpansion) {
      detailEmbed.addFields(
        {
          name: `Expansions`,
          value: Array.isArray(this.gameInfo.boardgameexpansion) ? take(this.gameInfo.boardgameexpansion,10).map(d => `[${d.text}](https://boardgamegeek.com/boardgame/${d.objectid})`).join("\n") : `[${this.gameInfo.boardgameexpansion.text}](https://boardgamegeek.com/boardgame/${this.gameInfo.boardgameexpansion.objectid})`,
          inline: true
        }
      )
    }
    this.embeds.push(detailEmbed);
  }

  GetGameDescriptionEmbed() {
    //Embed 3 - Description
    let turndownForWhat = new TurndownService();
    let descriptionEmbed = new EmbedBuilder()
      .setTitle("Description")
      .setDescription(
        turndownForWhat.turndown(he.decode(this.gameInfo.description))
      );
    this.embeds.push(descriptionEmbed);
  }

  GetGameAwardsEmbed() {
    //Embed 4 - awards and honors
    if (this.gameInfo.boardgamehonor && Array.isArray(this.gameInfo.boardgamehonor)) {
      let honors = "";
      this.gameInfo.boardgamehonor.forEach((honor) => {
        honors += `${he.decode(honor.text)}\n`;
      });
      let awardEmbed = new EmbedBuilder()
        .setTitle(`Awards and Honors`)
        .setDescription(honors);
      this.embeds.push(awardEmbed);
    }
  }

  async GetHistoryEmbed() {
    //Embed 5 - Local Data
    let local = await this.discordClient.queryGameData(this.interaction.guildId, 'game', {bggGameId: this.gameId})
    if (local && local.length > 0) {
      let history = ""
      local.forEach(game => {
        if (game.isdeleted) return
        if (game.winner != null && game.winner != ""){
          history += `**<#${game.id}>** - 👑 ${Formatter.winnerName(game, this.interaction.guild)}\n`
        } else {
          history += `**<#${game.id}>** - In Progress\n`  
        }
      });

      let localEmbed = new EmbedBuilder()
        .setTitle(`${this.gameName} in ${this.interaction.guild.name}`)
        .setDescription(history)
      
      this.embeds.push(localEmbed)
    }
  }

  async GetUsefulLinksEmbed() {
    let linkData = Object.assign(
      {},
      cloneDeep(GameDB.defaultBGGGameData),
      await this.discordClient.getGameDataV2(this.interaction.guildId, 'bgg', this.gameId)
    );

    if (linkData.links.length > 0) {
      let links = "";
      linkData.links.forEach((link) => {
        links += `🔗 [${link.name}](${link.url})\n`;
      });
      let linkEmbed = new EmbedBuilder()
        .setTitle(`Useful Links`)
        .setDescription(links);
      this.embeds.push(linkEmbed);
    }

    if (linkData.attachments.length > 0) {
      linkData.attachments.forEach((attach) => {
        this.otherAttachments.push(attach.url)
      });
    }
  }
}

module.exports = BoardGameGeek;